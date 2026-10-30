/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	JSONInt,
	Mint,
	MintInfo,
	NetworkError,
	Wallet,
	normalizeMintUrl,
	type GetInfoResponse,
	type KeyChainCache,
	type RequestFn,
} from '@cashu/cashu-ts';
/* Application Dependencies */
import {UserService} from '#server/modules/user/user.service';
import {UserRole} from '#server/modules/user/user.enums';
/* Native Dependencies */
import {MintRedirectError} from '#server/modules/cashu/wallet/classes/mint-redirect-error.class';
/* Local Dependencies */
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {CashuWalletMintTransportService} from './cashuwalletminttransport.service.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletOperation} from '../saga/cashuwalletoperation.entity.js';
import {WalletProofState, WalletOperationState, WalletMintMatch} from '../cashuwallet.enums.js';
import {describeMintError, walletError} from '../cashuwallet.helpers.js';
import type {
	CashuWalletMintFetch,
	CashuWalletMintLookup,
	CashuWalletMintProbe,
	CashuWalletMintRecord,
	CashuWalletMintResolution,
	CashuWalletMintStatus,
	OrchardMintIdentity,
} from '../cashuwallet.types.js';

const ORCHARD_RETRY_MS = 30_000;
const WALLET_TTL_MS = 5 * 60_000;
const STATUS_TTL_MS = 60_000;
const MINT_REDIRECTS_MAX = 3;

type Memo<T> = {value: Promise<T>; expires_at: number};

@Injectable()
export class CashuWalletMintService {
	private readonly logger = new Logger(CashuWalletMintService.name);
	private orchard_live: OrchardMintIdentity | null = null;
	private orchard_cached: OrchardMintIdentity | null | undefined = undefined;
	private orchard_lookup: Promise<OrchardMintIdentity | null> | null = null;
	private orchard_failed_at = 0;
	private wallets = new Map<string, Memo<Wallet>>();
	private statuses = new Map<string, Memo<CashuWalletMintProbe>>();
	private lookups = new Map<string, Memo<CashuWalletMintFetch>>();

	constructor(
		@InjectRepository(CashuWalletMint)
		private walletMintRepository: Repository<CashuWalletMint>,
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private configService: ConfigService,
		private cashuWalletMintCacheService: CashuWalletMintCacheService,
		private cashuWalletMintTransportService: CashuWalletMintTransportService,
		private userService: UserService,
	) {}

	/* *******************************************************
		Registry
	******************************************************** */

	/** List a user's wallet mints with their cached info */
	public async listMints(user_id: string): Promise<CashuWalletMintRecord[]> {
		const [identity, mints] = await this.loadMints(user_id);
		return this.toRecords(mints, identity);
	}

	/** A user's wallet mints with the Orchard identity, adding the Orchard mint if it's missing once its live identity is known */
	private async loadMints(user_id: string): Promise<[OrchardMintIdentity | null, CashuWalletMint[]]> {
		const [identity, mints] = await Promise.all([
			this.getOrchardIdentity(),
			this.walletMintRepository.find({where: {user_id}, order: {created_at: 'ASC'}}),
		]);
		const live = this.orchard_live;
		if (live && !mints.some((mint) => this.isOrchardMint(mint, live))) {
			mints.push(await this.ensureOrchardMint(user_id, live));
		}
		return [identity, mints];
	}

	/** Look a mint up before adding it: a URL already in the wallet matches without contacting the mint, else its info, timing and any wallet mint with its pubkey; local addresses need allow_local */
	public async lookupMint(user_id: string, url: string, allow_local = false): Promise<CashuWalletMintLookup> {
		const resolved = await this.resolveMint(user_id, url, allow_local, await this.getOrchardIdentity());
		if ('known' in resolved) {
			return {
				url: resolved.url,
				info: null,
				latency_ms: null,
				time_offset: null,
				match: WalletMintMatch.URL,
				mint_id: resolved.known.id,
			};
		}
		const {fetched, sibling} = resolved;
		return {
			url: resolved.url,
			info: JSONInt.stringify(fetched.info.cache),
			latency_ms: fetched.latency_ms,
			time_offset: fetched.time_offset,
			match: sibling ? WalletMintMatch.PUBKEY : null,
			mint_id: sibling?.id ?? null,
		};
	}

	/** Add a mint to a user's wallet from its lookup, shared for 60s so what was reviewed is what's saved; a URL already in the wallet returns its mint, and a mint with the same pubkey gains the URL */
	public async addMint(user_id: string, url: string, allow_local = false): Promise<CashuWalletMintRecord> {
		const identity = await this.getOrchardIdentity();
		const resolved = await this.resolveMint(user_id, url, allow_local, identity);
		if ('known' in resolved) {
			const [record] = await this.toRecords([resolved.known], identity);
			return record;
		}
		const {fetched, sibling} = resolved;
		await this.cashuWalletMintCacheService.saveInfo(resolved.url, fetched.info);
		const mint =
			sibling ??
			this.walletMintRepository.create({
				user_id,
				pubkey: fetched.info.pubkey || null,
				urls: [],
				created_at: DateTime.now().toUnixInteger(),
			});
		mint.urls = [...mint.urls, resolved.url];
		const [record] = await this.toRecords([await this.walletMintRepository.save(mint)], identity);
		return record;
	}

	/** Resolve a URL against a user's wallet: the wallet mint it already reaches without asking the mint, else the mint behind it (shared for 60s) and any wallet mint with its pubkey */
	private async resolveMint(
		user_id: string,
		url: string,
		allow_local: boolean,
		identity: OrchardMintIdentity | null,
	): Promise<CashuWalletMintResolution> {
		const mint_url = this.parseMintUrl(url);
		const known = await this.findKnownMint(user_id, mint_url, identity);
		if (known) return {url: mint_url, known};
		const fetched = await this.memoize(this.lookups, `${allow_local}:${mint_url}`, STATUS_TTL_MS, () =>
			this.fetchMint(mint_url, allow_local),
		);
		const redirected_known = fetched.url === mint_url ? null : await this.findKnownMint(user_id, fetched.url, identity);
		if (redirected_known) return {url: fetched.url, known: redirected_known};
		const pubkey = fetched.info.pubkey || null;
		this.assertNotOrchardClaim(fetched.url, pubkey, identity);
		const sibling = pubkey ? await this.findByIdentity(user_id, pubkey, []) : null;
		return {url: fetched.url, fetched, sibling};
	}

	/** The wallet mint a URL already reaches: the Orchard mint for the URLs it publishes, else any wallet mint listing it */
	private findKnownMint(user_id: string, mint_url: string, identity: OrchardMintIdentity | null): Promise<CashuWalletMint | null> {
		return identity && this.isOrchardUrl(mint_url, identity)
			? this.getOrchardMint(user_id)
			: this.findByIdentity(user_id, null, [mint_url]);
	}

	/** Wallet mints with the Orchard flag and the cached info of the URL each is reached at; the Orchard mint lists only the URLs it publishes now */
	private async toRecords(mints: CashuWalletMint[], identity: OrchardMintIdentity | null): Promise<CashuWalletMintRecord[]> {
		const infos = await this.cashuWalletMintCacheService.getInfos(mints.map((mint) => this.sourceUrl(mint, identity)));
		return mints.map((mint) => {
			const info = infos.get(this.sourceUrl(mint, identity));
			const is_orchard = this.isOrchardMint(mint, identity);
			const urls = is_orchard && identity ? identity.urls : mint.urls;
			return {...mint, urls, is_orchard, name: info?.name ?? null, info: info?.info ?? null};
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

	/** Share one load per key for ttl_ms; a failed load is dropped so the next caller retries, and expired loads are dropped as new ones are stored */
	private memoize<T>(cache: Map<string, Memo<T>>, key: string, ttl_ms: number, load: () => Promise<T>): Promise<T> {
		const now = Date.now();
		const cached = cache.get(key);
		if (cached && cached.expires_at > now) return cached.value;
		for (const [stale_key, memo] of cache) if (memo.expires_at <= now) cache.delete(stale_key);
		const value = load().catch((error) => {
			cache.delete(key);
			throw error;
		});
		cache.set(key, {value, expires_at: now + ttl_ms});
		return value;
	}

	/** cashu-ts Mint client for a wallet mint: MINT_API for the Orchard mint, the guarded transport for the rest, which reaches local addresses only for an admin's mints */
	public async getMint(mint: CashuWalletMint): Promise<Mint> {
		const identity = await this.getOrchardIdentity();
		const url = this.sourceUrl(mint, identity);
		const transport = this.cashuWalletMintTransportService;
		if (identity && this.isOrchardMint(mint, identity)) return new Mint(url, {customRequest: transport.request});
		const owner = await this.userService.getUserById(mint.user_id);
		return new Mint(url, {customRequest: transport.guardedRequest(owner?.role === UserRole.ADMIN)});
	}

	/** URL a wallet mint is reached at, which also keys its shared cache: MINT_API for the Orchard mint, else its first URL */
	private sourceUrl(mint: CashuWalletMint, identity: OrchardMintIdentity | null): string {
		return identity && this.isOrchardMint(mint, identity) ? identity.api_url : mint.urls[0];
	}

	/* *******************************************************
		Status
	******************************************************** */

	/** Check the mints in a user's wallet in parallel, or just one; a mint is online when its /v1/info answers */
	public async checkMints(user_id: string, mint_id: string | null = null): Promise<CashuWalletMintStatus[]> {
		const [, wallet_mints] = await this.loadMints(user_id);
		const mints = wallet_mints.filter((mint) => mint_id === null || mint.id === mint_id);
		return Promise.all(mints.map(async (mint) => ({mint_id: mint.id, ...(await this.checkMint(mint))})));
	}

	/** One mint URL's status, shared across users for STATUS_TTL_MS so strict mints aren't probed on every page load */
	private async checkMint(mint: CashuWalletMint): Promise<CashuWalletMintProbe> {
		const client = await this.getMint(mint);
		return this.memoize(this.statuses, client.mintUrl, STATUS_TTL_MS, () => this.probeMint(client));
	}

	/** Time a mint's /v1/info, saving the fresh info and refreshing its keysets when they are due; for the Orchard mint it also renews the live identity */
	private async probeMint(mint: Mint): Promise<CashuWalletMintProbe> {
		const started_at = Date.now();
		let info: MintInfo;
		try {
			info = new MintInfo(await mint.getInfo());
		} catch (error) {
			return {online: false, latency_ms: null, error: describeMintError(error), checked_at: DateTime.now().toUnixInteger()};
		}
		const latency_ms = Date.now() - started_at;
		if (mint.mintUrl === this.orchard_live?.api_url) this.orchard_live = this.toOrchardIdentity(mint.mintUrl, info.cache);
		await this.cashuWalletMintCacheService
			.saveInfo(mint.mintUrl, info)
			.then(() => (this.orchard_cached = undefined))
			.then(() => this.cashuWalletMintCacheService.refreshKeysets(mint))
			.catch((error) => this.logger.warn(`Cache of ${mint.mintUrl} not refreshed: ${describeMintError(error)}`));
		return {online: true, latency_ms, error: null, checked_at: DateTime.now().toUnixInteger()};
	}

	/* *******************************************************
		Orchard Mint
	******************************************************** */

	/** Identity of the mint Orchard manages, for recognizing and reaching it: the live one, else its cached /v1/info while a lookup runs */
	public async getOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		if (this.orchard_live) return this.orchard_live;
		const live = this.getLiveOrchardIdentity();
		return (await this.getCachedOrchardIdentity()) ?? live;
	}

	/** Identity from the mint itself, for anything that writes; one lookup at a time, a failed lookup is retried after ORCHARD_RETRY_MS */
	private getLiveOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		if (this.orchard_live) return Promise.resolve(this.orchard_live);
		if (Date.now() - this.orchard_failed_at < ORCHARD_RETRY_MS) return Promise.resolve(null);
		this.orchard_lookup ??= this.loadOrchardIdentity().then((identity) => {
			this.orchard_lookup = null;
			if (identity) this.orchard_live = identity;
			else this.orchard_failed_at = Date.now();
			return identity;
		});
		return this.orchard_lookup;
	}

	/** The Orchard mint's identity from the /v1/info last saved for MINT_API, read once until a probe saves fresh info */
	private async getCachedOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		if (this.orchard_cached !== undefined) return this.orchard_cached;
		try {
			const api_mint_url = this.getApiMintUrl();
			const info = api_mint_url ? await this.cashuWalletMintCacheService.getInfo(api_mint_url) : null;
			this.orchard_cached = api_mint_url && info ? this.toOrchardIdentity(api_mint_url, info) : null;
		} catch (error) {
			this.logger.warn(`Cached Orchard mint info unreadable: ${error?.message ?? error}`);
			this.orchard_cached = null;
		}
		return this.orchard_cached;
	}

	/** The Orchard mint in a user's wallet, added if missing; refused while the mint can't be reached */
	public async getOrchardMint(user_id: string): Promise<CashuWalletMint> {
		const identity = await this.getLiveOrchardIdentity();
		if (!identity) throw walletError('The Orchard mint is not responding at MINT_API; check that the mint is running');
		return this.ensureOrchardMint(user_id, identity);
	}

	/** Return the Orchard mint from a user's wallet, adding it under MINT_API if it's not there yet, a key that holds while its public URLs change */
	private async ensureOrchardMint(user_id: string, identity: OrchardMintIdentity): Promise<CashuWalletMint> {
		const existing = await this.findOrchardMint(user_id, identity);
		if (existing) return existing;
		try {
			return await this.walletMintRepository.save(
				this.walletMintRepository.create({
					user_id,
					pubkey: identity.pubkey,
					urls: [identity.api_url],
					created_at: DateTime.now().toUnixInteger(),
				}),
			);
		} catch (error) {
			const raced = await this.findOrchardMint(user_id, identity);
			if (raced) return raced;
			throw error;
		}
	}

	/** Look up the Orchard mint through MINT_API; its public URLs come from its own /v1/info */
	private async loadOrchardIdentity(): Promise<OrchardMintIdentity | null> {
		try {
			const api_mint_url = this.getApiMintUrl();
			if (!api_mint_url) return null;
			const info = await this.fetchMintInfo(api_mint_url, this.cashuWalletMintTransportService.request);
			await this.cashuWalletMintCacheService
				.saveInfo(api_mint_url, info)
				.catch((error) => this.logger.warn(`Orchard mint info not cached: ${describeMintError(error)}`));
			if (!info.pubkey) this.logger.warn('Orchard mint publishes no pubkey; wallets recognize it by URL only');
			return this.toOrchardIdentity(api_mint_url, info);
		} catch (error) {
			this.logger.warn(
				`Orchard mint info unavailable; it joins wallets once it responds: ${error?.details ?? error?.message ?? error}`,
			);
			return null;
		}
	}

	/** MINT_API, normalized; null when no mint is configured */
	private getApiMintUrl(): string | null {
		const api_url = this.configService.get<string>('cashu.api');
		return api_url ? normalizeMintUrl(api_url) : null;
	}

	/** The Orchard mint's identity from its /v1/info: its pubkey and public URLs */
	private toOrchardIdentity(api_mint_url: string, info: Pick<GetInfoResponse, 'pubkey' | 'urls'>): OrchardMintIdentity {
		return {pubkey: info.pubkey || null, urls: this.normalizeUrls(info.urls ?? []), api_url: api_mint_url};
	}

	/** The Orchard mint in a user's wallet, by the same rule that flags it */
	private async findOrchardMint(user_id: string, identity: OrchardMintIdentity): Promise<CashuWalletMint | null> {
		const mints = await this.walletMintRepository.find({where: {user_id}});
		return mints.find((mint) => this.isOrchardMint(mint, identity)) ?? null;
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

	/** Time a fresh /v1/info against Orchard's clock; a redirect is followed to the mint behind it, which is then known by the first URL it publishes */
	private async fetchMint(mint_url: string, allow_local: boolean): Promise<CashuWalletMintFetch> {
		const request = this.cashuWalletMintTransportService.guardedRequest(allow_local);
		let url = mint_url;
		for (let hops = 0; ; hops++) {
			const started_at = Date.now();
			let info: MintInfo;
			try {
				info = await this.requestMintInfo(url, request);
			} catch (error) {
				if (!(error instanceof MintRedirectError) || !error.location || hops >= MINT_REDIRECTS_MAX) {
					throw this.toLookupError(url, error);
				}
				url = this.parseMintUrl(error.location.replace(/\/v1\/info\/?$/, ''));
				continue;
			}
			const mint_time = info.cache.time;
			return {
				url: hops === 0 ? url : (this.normalizeUrls(info.cache.urls ?? [])[0] ?? url),
				info,
				latency_ms: Date.now() - started_at,
				time_offset: mint_time ? mint_time - DateTime.now().toUnixInteger() : null,
			};
		}
	}

	/** Refuse a URL that claims the Orchard mint's pubkey without being one the Orchard mint publishes */
	private assertNotOrchardClaim(mint_url: string, pubkey: string | null, identity: OrchardMintIdentity | null): void {
		if (identity?.pubkey && pubkey === identity.pubkey) {
			throw walletError(`${mint_url} claims to be your Orchard mint but isn't one of the URLs it publishes`);
		}
	}

	/** Fetch and validate a mint's /v1/info, as an operator-readable error when it fails */
	private fetchMintInfo(mint_url: string, request: RequestFn): Promise<MintInfo> {
		return this.requestMintInfo(mint_url, request).catch((error) => {
			throw this.toLookupError(mint_url, error);
		});
	}

	/** Fetch and validate a mint's /v1/info through cashu-ts, failing with the transport's own error */
	private requestMintInfo(mint_url: string, request: RequestFn): Promise<MintInfo> {
		return new Mint(mint_url, {customRequest: request}).getLazyMintInfo();
	}

	/** A failed /v1/info for the operator: an unreachable endpoint and why, else what the mint answered */
	private toLookupError(mint_url: string, error: unknown): ReturnType<typeof walletError> {
		if (error instanceof NetworkError) return walletError(`Couldn't reach ${error.message}`);
		return walletError(`Mint at ${mint_url} could not be looked up: ${describeMintError(error)}`);
	}

	/** Normalize a user-supplied mint URL, taking https when no scheme is given, and surfacing cashu-ts validation as an operator-readable error */
	private parseMintUrl(url: string): string {
		const trimmed = url.trim();
		try {
			return normalizeMintUrl(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
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
}
