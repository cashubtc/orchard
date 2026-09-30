/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	HttpResponseError,
	JSONInt,
	Mint,
	MintInfo,
	MintOperationError,
	NetworkError,
	RateLimitError,
	Wallet,
	normalizeMintUrl,
	type KeyChainCache,
	type RequestFn,
	type RequestOptions,
} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {assertPublicHost} from '#server/modules/fetch/network-guard';
/* Local Dependencies */
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletOperation} from '../saga/cashuwalletoperation.entity.js';
import {WalletProofState, WalletOperationState} from '../cashuwallet.enums.js';
import {MintAddressError, describeMintError, walletError} from '../cashuwallet.helpers.js';
import type {CashuWalletMintProbe, CashuWalletMintRecord, CashuWalletMintStatus, OrchardMintIdentity} from '../cashuwallet.types.js';

const MINT_TIMEOUT_MS = 10_000;
const MINT_MAX_BYTES = 256 * 1024;
const ORCHARD_RETRY_MS = 30_000;
const WALLET_TTL_MS = 5 * 60_000;
const STATUS_TTL_MS = 60_000;

type Memo<T> = {value: Promise<T>; expires_at: number};

@Injectable()
export class CashuWalletMintService {
	private readonly logger = new Logger(CashuWalletMintService.name);
	private readonly request: RequestFn = (options) => this.requestMint(options);
	private readonly guarded_request: RequestFn = (options) => this.requestPublicMint(options);
	private orchard_identity: Promise<OrchardMintIdentity | null> | null = null;
	private orchard_failed_at = 0;
	private wallets = new Map<string, Memo<Wallet>>();
	private statuses = new Map<string, Memo<CashuWalletMintProbe>>();

	constructor(
		@InjectRepository(CashuWalletMint)
		private walletMintRepository: Repository<CashuWalletMint>,
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private configService: ConfigService,
		private fetchService: FetchService,
		private cashuWalletMintCacheService: CashuWalletMintCacheService,
	) {}

	/* *******************************************************
		Registry
	******************************************************** */

	/** List a user's wallet mints with their cached info, adding the Orchard mint if it's missing */
	public async listMints(user_id: string): Promise<CashuWalletMintRecord[]> {
		const identity = await this.getOrchardIdentity();
		const mints = await this.walletMintRepository.find({where: {user_id}, order: {created_at: 'ASC'}});
		if (identity && !mints.some((mint) => this.matchesIdentity(mint, identity.pubkey, identity.urls))) {
			mints.push(await this.ensureOrchardMint(user_id, identity));
		}
		return this.toRecords(mints, identity);
	}

	/** Add a mint to a user's wallet after looking it up; a known mint gains the URL instead */
	public async addMint(user_id: string, url: string): Promise<CashuWalletMintRecord> {
		const mint_url = this.parseMintUrl(url);
		const identity = await this.getOrchardIdentity();
		if (identity && this.isOrchardUrl(mint_url, identity)) {
			const [record] = await this.toRecords([await this.ensureOrchardMint(user_id, identity)], identity);
			return record;
		}

		await this.assertPublicMintUrl(mint_url);
		const info = await this.fetchMintInfo(mint_url);
		const pubkey = info.pubkey || null;
		if (identity?.pubkey && pubkey === identity.pubkey) {
			throw walletError(`${mint_url} claims to be your Orchard mint but isn't one of the URLs it publishes`);
		}
		await this.cashuWalletMintCacheService.saveInfo(mint_url, info);
		const existing = await this.findByIdentity(user_id, pubkey, [mint_url]);
		const mint = existing ?? this.walletMintRepository.create({user_id, pubkey, urls: [], created_at: DateTime.now().toUnixInteger()});
		mint.urls = [...new Set([...mint.urls, mint_url])];
		const [record] = await this.toRecords([await this.walletMintRepository.save(mint)], identity);
		return record;
	}

	/** Wallet mints with the Orchard flag and the cached info of the URL each is reached at */
	private async toRecords(mints: CashuWalletMint[], identity: OrchardMintIdentity | null): Promise<CashuWalletMintRecord[]> {
		const infos = await this.cashuWalletMintCacheService.getInfos(mints.map((mint) => this.sourceUrl(mint, identity)));
		return mints.map((mint) => {
			const info = infos.get(this.sourceUrl(mint, identity));
			return {...mint, is_orchard: this.isOrchardMint(mint, identity), name: info?.name ?? null, info: info?.info ?? null};
		});
	}

	/** Remove a mint from a user's wallet; refused for the Orchard mint or while it holds funds */
	public async removeMint(user_id: string, mint_id: string): Promise<void> {
		const mint = await this.walletMintRepository.findOne({where: {id: mint_id, user_id}});
		if (!mint) throw walletError('Mint not found in this wallet');
		if (this.isOrchardMint(mint, await this.getOrchardIdentity())) {
			throw walletError('The Orchard mint cannot be removed from a wallet');
		}
		const held_states = In([WalletProofState.READY, WalletProofState.INFLIGHT]);
		if (await this.walletProofRepository.count({where: {user_id, mint_id, state: held_states}})) {
			throw walletError('This mint still holds ecash in the wallet; spend or move it first');
		}
		const open_states = In([WalletOperationState.PENDING, WalletOperationState.EXECUTING]);
		if (await this.walletOperationRepository.count({where: {user_id, mint_id, state: open_states}})) {
			throw walletError('This mint has wallet operations in progress');
		}
		await this.walletMintRepository.delete({id: mint.id});
	}

	/** Loaded cashu-ts wallet for a mint and unit, cached briefly; cashu-ts repairs stale keysets itself */
	public getWallet(mint_id: string, unit: string): Promise<Wallet> {
		return this.memoize(this.wallets, `${mint_id}:${unit}`, WALLET_TTL_MS, () => this.loadWallet(mint_id, unit));
	}

	/** Save a wallet's keychain to the shared cache; cashu-ts leaves explicit loads to the caller, and a failed save is only logged */
	public saveKeychain(cache: KeyChainCache): Promise<void> {
		return this.cashuWalletMintCacheService
			.saveKeychain(cache)
			.catch((error) => this.logger.warn(`Keyset cache not saved: ${describeMintError(error)}`));
	}

	/** Build a cashu-ts wallet from the shared cache, loading from the mint only when nothing usable is cached for its unit */
	private async loadWallet(mint_id: string, unit: string): Promise<Wallet> {
		const wallet = new Wallet(await this.getMint(await this.walletMintRepository.findOneByOrFail({id: mint_id})), {unit});
		if (!(await this.loadFromCache(wallet))) {
			await wallet.loadMint(true);
			await this.cashuWalletMintCacheService
				.saveWallet(wallet)
				.catch((error) => this.logger.warn(`Mint cache not saved: ${describeMintError(error)}`));
		}
		wallet.on.keychainUpdated(({cache}) => void this.saveKeychain(cache));
		return wallet;
	}

	/** Load a wallet from the shared cache; false when nothing usable is cached for its unit */
	private async loadFromCache(wallet: Wallet): Promise<boolean> {
		try {
			const cache = await this.cashuWalletMintCacheService.getWalletCache(wallet.mint.mintUrl);
			if (!cache) return false;
			wallet.loadMintFromCache(cache.info, cache.keychain);
			return wallet.getKeyset().hasKeys;
		} catch {
			return false;
		}
	}

	/** Share one load per key for ttl_ms; a failed load is dropped so the next caller retries */
	private memoize<T>(cache: Map<string, Memo<T>>, key: string, ttl_ms: number, load: () => Promise<T>): Promise<T> {
		const cached = cache.get(key);
		if (cached && cached.expires_at > Date.now()) return cached.value;
		const value = load().catch((error) => {
			cache.delete(key);
			throw error;
		});
		cache.set(key, {value, expires_at: Date.now() + ttl_ms});
		return value;
	}

	/** cashu-ts Mint client for a wallet mint: MINT_API for the Orchard mint, the guarded transport for the rest */
	public async getMint(mint: CashuWalletMint): Promise<Mint> {
		const identity = await this.getOrchardIdentity();
		const request = identity && this.isOrchardMint(mint, identity) ? this.request : this.guarded_request;
		return new Mint(this.sourceUrl(mint, identity), {customRequest: request});
	}

	/** URL a wallet mint is reached at, which also keys its shared cache: MINT_API for the Orchard mint, else its first URL */
	private sourceUrl(mint: CashuWalletMint, identity: OrchardMintIdentity | null): string {
		return identity && this.isOrchardMint(mint, identity) ? identity.api_url : mint.urls[0];
	}

	/* *******************************************************
		Status
	******************************************************** */

	/** Check every mint in a user's wallet in parallel; a mint is online when its /v1/info answers */
	public async checkMints(user_id: string): Promise<CashuWalletMintStatus[]> {
		const mints = await this.listMints(user_id);
		return Promise.all(mints.map(async (mint) => ({mint_id: mint.id, ...(await this.checkMint(mint))})));
	}

	/** One mint URL's status, shared across users for STATUS_TTL_MS so strict mints aren't probed on every page load */
	private async checkMint(mint: CashuWalletMint): Promise<CashuWalletMintProbe> {
		const client = await this.getMint(mint);
		return this.memoize(this.statuses, client.mintUrl, STATUS_TTL_MS, () => this.probeMint(client));
	}

	/** Time a mint's /v1/info, saving the fresh info and refreshing its keysets when they are due */
	private async probeMint(mint: Mint): Promise<CashuWalletMintProbe> {
		const started_at = Date.now();
		let info: MintInfo;
		try {
			info = new MintInfo(await mint.getInfo());
		} catch (error) {
			return {online: false, latency_ms: null, error: describeMintError(error), checked_at: DateTime.now().toUnixInteger()};
		}
		const latency_ms = Date.now() - started_at;
		await this.cashuWalletMintCacheService
			.saveInfo(mint.mintUrl, info)
			.then(() => this.cashuWalletMintCacheService.refreshKeysets(mint))
			.catch((error) => this.logger.warn(`Cache of ${mint.mintUrl} not refreshed: ${describeMintError(error)}`));
		return {online: true, latency_ms, error: null, checked_at: DateTime.now().toUnixInteger()};
	}

	/* *******************************************************
		Orchard Mint
	******************************************************** */

	/** Identity of the mint Orchard manages; memoized, a failed lookup is retried after ORCHARD_RETRY_MS */
	public getOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		if (!this.orchard_identity && Date.now() - this.orchard_failed_at < ORCHARD_RETRY_MS) return Promise.resolve(null);
		this.orchard_identity ??= this.loadOrchardIdentity().then((identity) => {
			if (!identity) {
				this.orchard_identity = null;
				this.orchard_failed_at = Date.now();
			}
			return identity;
		});
		return this.orchard_identity;
	}

	/** The Orchard mint in a user's wallet, added if missing; refused while the mint can't be reached */
	public async getOrchardMint(user_id: string): Promise<CashuWalletMint> {
		const identity = await this.getOrchardIdentity();
		if (!identity) throw walletError('The Orchard mint is not responding at MINT_API; check that the mint is running');
		return this.ensureOrchardMint(user_id, identity);
	}

	/** Return the Orchard mint from a user's wallet, adding it if it's not there yet */
	private async ensureOrchardMint(user_id: string, identity: OrchardMintIdentity): Promise<CashuWalletMint> {
		const existing = await this.findByIdentity(user_id, identity.pubkey, identity.urls);
		if (existing) return existing;
		try {
			return await this.walletMintRepository.save(
				this.walletMintRepository.create({
					user_id,
					pubkey: identity.pubkey,
					urls: identity.urls,
					created_at: DateTime.now().toUnixInteger(),
				}),
			);
		} catch (error) {
			const raced = await this.findByIdentity(user_id, identity.pubkey, identity.urls);
			if (raced) return raced;
			throw error;
		}
	}

	/** Look up the Orchard mint through MINT_API; its public URLs come from its own /v1/info */
	private async loadOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		const api_url = this.configService.get<string>('cashu.api');
		if (!api_url) return null;
		try {
			const api_mint_url = normalizeMintUrl(api_url);
			const info = await this.fetchMintInfo(api_mint_url);
			await this.cashuWalletMintCacheService
				.saveInfo(api_mint_url, info)
				.catch((error) => this.logger.warn(`Orchard mint info not cached: ${describeMintError(error)}`));
			const urls = this.normalizeUrls(info.urls ?? []);
			if (!info.pubkey) this.logger.warn('Orchard mint publishes no pubkey; wallets recognize it by URL only');
			return {pubkey: info.pubkey || null, urls: urls.length > 0 ? urls : [api_mint_url], api_url: api_mint_url};
		} catch (error) {
			this.logger.warn(
				`Orchard mint info unavailable; it joins wallets once it responds: ${error?.details ?? error?.message ?? error}`,
			);
			return null;
		}
	}

	/** Whether a wallet mint is the Orchard mint: by pubkey, or by URL only when the mint publishes no pubkey */
	private isOrchardMint(mint: CashuWalletMint, identity: OrchardMintIdentity | null): boolean {
		if (!identity) return false;
		if (identity.pubkey) return mint.pubkey === identity.pubkey;
		return mint.urls.some((url) => this.isOrchardUrl(url, identity));
	}

	/** Whether the Orchard mint vouches for a URL: MINT_API or one it publishes */
	private isOrchardUrl(mint_url: string, identity: OrchardMintIdentity): boolean {
		return mint_url === identity.api_url || identity.urls.includes(mint_url);
	}

	/* *******************************************************
		Lookup
	******************************************************** */

	/** Find a user's wallet mint by pubkey or any of its URLs */
	private async findByIdentity(user_id: string, pubkey: string | null, urls: string[]): Promise<CashuWalletMint | null> {
		const mints = await this.walletMintRepository.find({where: {user_id}});
		return mints.find((mint) => this.matchesIdentity(mint, pubkey, urls)) ?? null;
	}

	/** Whether a wallet mint has the given pubkey or shares a URL */
	private matchesIdentity(mint: CashuWalletMint, pubkey: string | null, urls: string[]): boolean {
		return (!!pubkey && mint.pubkey === pubkey) || mint.urls.some((url) => urls.includes(url));
	}

	/** Fetch and validate a mint's /v1/info through cashu-ts */
	private async fetchMintInfo(mint_url: string): Promise<MintInfo> {
		try {
			return await new Mint(mint_url, {customRequest: this.request}).getLazyMintInfo();
		} catch (error) {
			const status = error instanceof HttpResponseError ? ` (HTTP ${error.status})` : '';
			throw walletError(`Mint at ${mint_url} could not be looked up: ${error?.message ?? error}${status}`);
		}
	}

	/** Normalize a user-supplied mint URL, surfacing cashu-ts validation as an operator-readable error */
	private parseMintUrl(url: string): string {
		try {
			return normalizeMintUrl(url);
		} catch (error) {
			throw walletError(`Invalid mint URL "${url}": ${error?.message ?? error}`);
		}
	}

	/** Normalize a list of URLs, dropping invalid ones and duplicates */
	private normalizeUrls(urls: string[]): string[] {
		const normalized = urls.flatMap((url) => {
			try {
				return [normalizeMintUrl(url)];
			} catch {
				return [];
			}
		});
		return [...new Set(normalized)];
	}

	/** Refuse mint URLs that aren't https (onion via Tor excepted) or that reach a private network */
	private async assertPublicMintUrl(mint_url: string): Promise<void> {
		const {protocol, hostname} = new URL(mint_url);
		const host = hostname.replace(/^\[|\]$/g, '');
		if (host.endsWith('.onion')) {
			if (this.configService.get<string>('server.proxy')) return;
			throw walletError('Onion mints need a Tor proxy; set TOR_PROXY_SERVER');
		}
		if (protocol !== 'https:') throw walletError('Mint URLs must use https (http is only allowed for .onion mints)');
		const resolved = await assertPublicHost(host).catch((error) => {
			throw walletError(`${error?.message ?? error}; only public mints can be added`);
		});
		if (!resolved) throw walletError(`Could not resolve mint host ${host}`);
	}

	/* *******************************************************
		Transport
	******************************************************** */

	/** Transport for user-added mints: re-checks the address on every request before sending it */
	private async requestPublicMint<T>(options: RequestOptions): Promise<T> {
		await this.assertPublicMintUrl(options.endpoint).catch((error) => {
			throw new MintAddressError(error?.details ?? error?.message ?? String(error));
		});
		return this.requestMint<T>(options);
	}

	/** cashu-ts RequestFn over FetchService (Tor proxy, timeout, size cap, no redirects), keeping its error contract */
	private async requestMint<T>({endpoint, requestBody, headers, method, requestTimeout, signal}: RequestOptions): Promise<T> {
		const timeout_ms = requestTimeout ?? MINT_TIMEOUT_MS;
		const timeout = AbortSignal.timeout(timeout_ms);
		const toNetworkError = (error: any): never => {
			const reason = timeout.aborted ? `timed out after ${timeout_ms}ms` : (error?.code ?? error?.message ?? error);
			throw new NetworkError(`${endpoint}: ${reason}`, {cause: error});
		};
		const response = await this.fetchService
			.fetchWithProxy(endpoint, {
				method: method ?? (requestBody ? 'POST' : 'GET'),
				headers: {Accept: 'application/json', ...(requestBody && {'Content-Type': 'application/json'}), ...headers},
				body: requestBody ? JSONInt.stringify(requestBody) : undefined,
				redirect: 'error',
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
				size: MINT_MAX_BYTES,
			})
			.catch(toNetworkError);
		const text = await response.text().catch(toNetworkError);
		if (response.status === 429)
			throw new RateLimitError('429 Too Many Requests', this.parseRetryAfter(response.headers.get('Retry-After')));
		const body = this.parseBody(text);
		if (response.ok && body) return body as T;
		if (response.status === 400 && typeof body?.code === 'number' && typeof body?.detail === 'string') {
			throw new MintOperationError(body.code, body.detail);
		}
		throw new HttpResponseError(body?.error ?? body?.detail ?? 'HTTP request failed', response.status);
	}

	/** Parse a mint response body with cashu-ts JSONInt, null when it isn't JSON */
	private parseBody(text: string): any {
		try {
			return JSONInt.parse(text);
		} catch {
			return null;
		}
	}

	/** Retry-After header (seconds or HTTP date) in milliseconds */
	private parseRetryAfter(header: string | null): number | undefined {
		if (!header) return undefined;
		const seconds = Number(header);
		if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
		const date = Date.parse(header);
		return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
	}
}
