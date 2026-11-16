/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, IsNull, MoreThan, Raw, Repository, type FindOptionsWhere} from 'typeorm';
import {DateTime} from 'luxon';
import {isMintOperationError, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {describeMintError, walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {mintQuoteExpiry, mintQuoteTotals} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.helpers';
import {CASHU_WALLET_OPEN_STATES, CASHU_WALLET_QUOTE_METHODS} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import type {CashuWalletQuoteMethod} from '#server/modules/cashu/wallet/classes/cashu-wallet-quote-method.class';
import type {
	CashuWalletMintQuote,
	CashuWalletQuoteRecord,
	CashuWalletQuoteRequest,
	CashuWalletScope,
} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletQuote} from './cashuwalletquote.entity.js';

const BATCH_SIZE = 100;

@Injectable()
export class CashuWalletQuoteService {
	private readonly logger = new Logger(CashuWalletQuoteService.name);
	/** Work running now by key, so creates per wallet mint, method and unit, and settles per quote, run one at a time */
	private readonly running = new Map<string, Promise<unknown>>();

	constructor(
		@InjectRepository(CashuWalletQuote)
		private walletQuoteRepository: Repository<CashuWalletQuote>,
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletMintService: CashuWalletMintService,
		private cashuWalletIssueService: CashuWalletIssueService,
	) {}

	/* *******************************************************
		Quotes
	******************************************************** */

	/** A payment request at one of a user's wallet mints: a new bolt11 invoice, or an unpaid bolt12 offer or onchain address with the same terms before a new one */
	public async newQuote(request: CashuWalletQuoteRequest): Promise<CashuWalletQuoteRecord> {
		const method = this.findMethod(request.method);
		if (method.amount === 'required' && request.amount === null) throw walletError(`An amount is required for ${request.method}`);
		if (method.amount === 'none' && request.amount !== null) throw walletError(`${request.method} takes no amount`);
		await this.cashuWalletMintService.findWalletMint(request.user_id, request.mint_id);
		return this.serially(this.createKey(request), async () => this.toRecord(await this.provide(request, method)));
	}

	/** The bolt12 offer or onchain address a user's wallet receives on at a mint: its latest while that can be handed out, else a new any-amount one */
	public async openQuote(user_id: string, mint_id: string, method_name: string, unit: string): Promise<CashuWalletQuoteRecord> {
		const method = this.findMethod(method_name);
		if (!method.reusable) throw walletError(`${method_name} quotes are one-off; create a new one`);
		await this.cashuWalletMintService.findWalletMint(user_id, mint_id);
		const request: CashuWalletQuoteRequest = {user_id, mint_id, method: method_name, unit, amount: null, description: null};
		return this.serially(this.createKey(request), async () => {
			const latest = await this.walletQuoteRepository.findOneBy({user_id, mint_id, method: method_name, unit, latest: true});
			const checked = latest ? await this.check(latest, method) : null;
			const current = checked && method.canHandOut(checked, DateTime.now().toUnixInteger());
			return this.toRecord(current ? checked : await this.provide(request, method));
		});
	}

	/** An unpaid quote with the same terms when the method is reusable, else a new one from the mint; a reusable one becomes the latest */
	private async provide(request: CashuWalletQuoteRequest, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote> {
		const wallet = await this.cashuWalletMintService.getWallet(request.mint_id, request.unit);
		const described = method.describes(wallet.getMintInfo(), request.unit);
		const terms = {...request, description: (described && request.description) || null};
		if (!method.reusable) return this.create(wallet, terms, method);
		return this.makeLatest((await this.reuse(terms, method)) ?? (await this.create(wallet, terms, method)));
	}

	/** The newest unpaid quote with these terms and time left, if the mint still shows it unpaid */
	private async reuse(request: CashuWalletQuoteRequest, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote | null> {
		const {user_id, mint_id, unit} = request;
		const now = DateTime.now().toUnixInteger();
		const unpaid = await this.walletQuoteRepository.find({
			where: {
				user_id,
				mint_id,
				method: request.method,
				unit,
				amount: request.amount ?? IsNull(),
				description: request.description ?? IsNull(),
				amount_paid: 0,
			},
			order: {created_at: 'DESC'},
		});
		const candidate = unpaid.find((quote) => method.canHandOut(quote, now));
		if (!candidate) return null;
		const checked = await this.check(candidate, method);
		return checked.amount_paid === 0 ? checked : null;
	}

	/** Ask the mint for a quote, NUT-20 locked to a fresh seed key when the method locks at this mint, and record it */
	private async create(wallet: Wallet, request: CashuWalletQuoteRequest, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote> {
		const key = method.locks(wallet.getMintInfo()) ? await this.cashuWalletIssueService.reserveQuoteKey(request.user_id) : null;
		const remote = await method.create(wallet, key?.pubkey ?? null, request.amount, request.description ?? undefined);
		const now = DateTime.now().toUnixInteger();
		const expiry = mintQuoteExpiry(remote);
		return this.walletQuoteRepository.save(
			this.walletQuoteRepository.create({
				user_id: request.user_id,
				mint_id: request.mint_id,
				method: request.method,
				unit: request.unit,
				quote_id: remote.quote,
				quote_counter: key?.counter ?? null,
				request: remote.request,
				amount: request.amount,
				description: request.description,
				expiry,
				amount_paid: 0,
				amount_issued: 0,
				latest: false,
				check_until: method.checkUntil(expiry, now),
				created_at: now,
				updated_at: now,
			}),
		);
	}

	/** Make a reusable quote the one shown for its mint, method and unit */
	private async makeLatest(quote: CashuWalletQuote): Promise<CashuWalletQuote> {
		if (quote.latest) return quote;
		const {user_id, mint_id, method, unit} = quote;
		await this.walletQuoteRepository.update({user_id, mint_id, method, unit, latest: true}, {latest: false});
		return this.writeQuote(quote, {latest: true});
	}

	/** Write changes to a quote unless they change nothing, stamping when it changed */
	private async writeQuote(quote: CashuWalletQuote, changes: Partial<CashuWalletQuote>): Promise<CashuWalletQuote> {
		const changed = Object.entries(changes).some(([field, value]) => quote[field as keyof CashuWalletQuote] !== value);
		if (!changed) return quote;
		const update = {...changes, updated_at: DateTime.now().toUnixInteger()};
		await this.walletQuoteRepository.update({id: quote.id}, update);
		return {...quote, ...update};
	}

	/* *******************************************************
		Checking
	******************************************************** */

	/** Check the quotes still worth checking and mint what's been paid: each latest offer or address, any inside its window, and any paid but not yet minted */
	public async checkQuotes(scope: CashuWalletScope = {}): Promise<void> {
		const now = DateTime.now().toUnixInteger();
		const quotes = await this.walletQuoteRepository.find({
			where: [
				{...scope, latest: true},
				{...scope, check_until: MoreThan(now)},
				{...scope, amount_paid: Raw((paid) => `${paid} > amount_issued`)},
			],
		});
		const groups = await this.groupByMint(quotes);
		await Promise.all([...groups.values()].map(({wallet, members}) => this.checkGroup(wallet, members)));
	}

	/** Quotes grouped by mint URL, unit and method across every user's wallet, each group with one wallet to check through; a wallet that can't load waits for the next pass */
	private async groupByMint(quotes: CashuWalletQuote[]): Promise<Map<string, {wallet: Wallet; members: CashuWalletQuote[]}>> {
		const wallets = new Map<string, Promise<Wallet | null>>();
		const loadWallet = ({mint_id, unit}: CashuWalletQuote): Promise<Wallet | null> => {
			const key = `${mint_id}:${unit}`;
			if (!wallets.has(key)) {
				const loading = this.cashuWalletMintService.getWallet(mint_id, unit).catch((error) => {
					this.logger.warn(`Wallet quotes at mint ${mint_id} could not be checked: ${describeMintError(error)}`);
					return null;
				});
				wallets.set(key, loading);
			}
			return wallets.get(key)!;
		};
		const loaded = await Promise.all(quotes.map(async (quote) => ({quote, wallet: await loadWallet(quote)})));
		const groups = new Map<string, {wallet: Wallet; members: CashuWalletQuote[]}>();
		for (const {quote, wallet} of loaded) {
			if (!wallet) continue;
			const key = `${wallet.mint.mintUrl}:${quote.unit}:${quote.method}`;
			const group = groups.get(key);
			if (group) group.members.push(quote);
			else groups.set(key, {wallet, members: [quote]});
		}
		return groups;
	}

	/** Check one mint's quotes of a method and unit through one wallet, settling each in turn; a mint that can't be reached waits for the next pass */
	private async checkGroup(wallet: Wallet, quotes: CashuWalletQuote[]): Promise<void> {
		const method_name = quotes[0].method;
		try {
			const method = this.findMethod(method_name);
			for (const [quote, remote] of await this.fetchQuotes(wallet, method_name, quotes)) await this.settle(quote, remote, method);
		} catch (error) {
			this.logger.warn(`Wallet quotes at ${wallet.mint.mintUrl} could not be checked: ${describeMintError(error)}`);
		}
	}

	/** The mint's view of each quote: in NUT-29 batches when it offers them for the method, else one by one */
	private async fetchQuotes(
		wallet: Wallet,
		method: string,
		quotes: CashuWalletQuote[],
	): Promise<[CashuWalletQuote, CashuWalletMintQuote][]> {
		const nut29 = wallet.getMintInfo().isSupported(29);
		if (!nut29.supported || !(nut29.params?.methods ?? [method]).includes(method)) return this.fetchEach(wallet, quotes);
		const size = nut29.params?.max_batch_size ?? BATCH_SIZE;
		const fetched: [CashuWalletQuote, CashuWalletMintQuote][] = [];
		for (let start = 0; start < quotes.length; start += size) {
			fetched.push(...(await this.fetchBatch(wallet, method, quotes.slice(start, start + size))));
		}
		return fetched;
	}

	/** One NUT-29 batch; a batch the mint refuses is split in halves to find the quotes it won't answer for, which get one check each */
	private async fetchBatch(
		wallet: Wallet,
		method: string,
		quotes: CashuWalletQuote[],
	): Promise<[CashuWalletQuote, CashuWalletMintQuote][]> {
		try {
			const remotes = await wallet.checkMintQuoteBatch<CashuWalletMintQuote>(
				method,
				quotes.map((quote) => quote.quote_id),
			);
			return quotes.map((quote, index): [CashuWalletQuote, CashuWalletMintQuote] => [quote, remotes[index]]);
		} catch (error) {
			if (!isMintOperationError(error)) throw error;
			if (quotes.length === 1) return this.fetchEach(wallet, quotes);
			const half = Math.ceil(quotes.length / 2);
			const first = await this.fetchBatch(wallet, method, quotes.slice(0, half));
			return [...first, ...(await this.fetchBatch(wallet, method, quotes.slice(half)))];
		}
	}

	/** The mint's view of each quote, one request each; a quote the mint refuses waits for the next check, and any other failure stops the mint's check */
	private async fetchEach(wallet: Wallet, quotes: CashuWalletQuote[]): Promise<[CashuWalletQuote, CashuWalletMintQuote][]> {
		const fetched: [CashuWalletQuote, CashuWalletMintQuote][] = [];
		for (const quote of quotes) {
			try {
				fetched.push([quote, await wallet.checkMintQuote<CashuWalletMintQuote>(quote.method, quote.quote_id)]);
			} catch (error) {
				if (!isMintOperationError(error)) throw error;
				this.logger.warn(`Wallet quote ${quote.id} could not be checked: ${describeMintError(error)}`);
			}
		}
		return fetched;
	}

	/** Check a quote at its mint now and mint what's been paid to it */
	private async check(quote: CashuWalletQuote, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote> {
		const wallet = await this.cashuWalletMintService.getWallet(quote.mint_id, quote.unit);
		return this.settle(quote, await wallet.checkMintQuote<CashuWalletMintQuote>(quote.method, quote.quote_id), method);
	}

	/** Record the mint's view of a quote and mint what's owed, one quote at a time */
	private settle(quote: CashuWalletQuote, remote: CashuWalletMintQuote, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote> {
		return this.serially(`settle:${quote.id}`, async () => {
			const current = await this.walletQuoteRepository.findOneByOrFail({id: quote.id});
			return this.claim(await this.observe(current, remote, method), method);
		});
	}

	/** Record what the mint reports, never letting paid or issued go down; a new payment keeps a quote without expiry checked for its window again */
	private async observe(
		quote: CashuWalletQuote,
		remote: CashuWalletMintQuote,
		method: CashuWalletQuoteMethod,
	): Promise<CashuWalletQuote> {
		const {paid, issued} = mintQuoteTotals(remote, quote.amount ?? 0);
		const amount_paid = Math.max(quote.amount_paid, paid.toNumber());
		const paid_now = amount_paid > quote.amount_paid;
		const window = method.checkUntil(quote.expiry, DateTime.now().toUnixInteger());
		return this.writeQuote(quote, {
			amount_paid,
			amount_issued: Math.max(quote.amount_issued, issued.toNumber()),
			check_until: paid_now ? Math.max(quote.check_until, window) : quote.check_until,
		});
	}

	/* *******************************************************
		Minting
	******************************************************** */

	/** Mint what's owed on a quote in pieces no bigger than the mint allows, counting the wallet's own mints in case the mint's totals lag; an open mint for it is left to recovery */
	private async claim(quote: CashuWalletQuote, method: CashuWalletQuoteMethod): Promise<CashuWalletQuote> {
		if (method.mintable(quote, quote.amount_issued) === 0) return this.recordMinted(quote, method, quote.amount_issued);
		const open = {...this.mintedFrom(quote), state: In(CASHU_WALLET_OPEN_STATES)};
		if (await this.walletOperationRepository.existsBy(open)) return quote;
		const issued = Math.max(quote.amount_issued, await this.mintedTotal(quote));
		let owed = method.mintable(quote, issued);
		if (owed === 0) return this.recordMinted(quote, method, issued);
		try {
			const wallet = await this.cashuWalletMintService.getWallet(quote.mint_id, quote.unit);
			const cap = method.maxAmount(wallet.getMintInfo(), quote.unit);
			while (owed > 0) {
				const amount = Math.min(owed, cap);
				const operation = await this.cashuWalletIssueService.createMintOperation({
					user_id: quote.user_id,
					mint_id: quote.mint_id,
					type: WalletOperationType.MINT,
					unit: quote.unit,
					amount,
					method: quote.method,
					quote_id: quote.quote_id,
					quote_counter: quote.quote_counter,
					memo: quote.description,
				});
				const minted = await this.cashuWalletIssueService.executeMintOperation(operation.id);
				if (minted.state !== WalletOperationState.FINALIZED) break;
				owed -= amount;
			}
		} catch (error) {
			this.logger.warn(`Wallet quote ${quote.id} could not be minted: ${describeMintError(error)}`);
		}
		return this.recordMinted(quote, method);
	}

	/** Note what's been minted from a quote, counted from the wallet's mints unless given; one that can take no more stops being checked */
	private async recordMinted(quote: CashuWalletQuote, method: CashuWalletQuoteMethod, minted?: number): Promise<CashuWalletQuote> {
		const amount_issued = Math.max(quote.amount_issued, minted ?? (await this.mintedTotal(quote)));
		const complete = method.isComplete(quote, amount_issued);
		return this.writeQuote(quote, {
			amount_issued,
			check_until: complete ? Math.min(quote.check_until, DateTime.now().toUnixInteger()) : quote.check_until,
		});
	}

	/** A quote with the total minted from it and how many mints that took */
	private async toRecord(quote: CashuWalletQuote): Promise<CashuWalletQuoteRecord> {
		const [received, payments] = await Promise.all([
			this.mintedTotal(quote),
			this.walletOperationRepository.countBy(this.mintedFrom(quote)),
		]);
		return {...quote, received, payments};
	}

	/** Total the wallet has minted from a quote */
	private async mintedTotal(quote: CashuWalletQuote): Promise<number> {
		return (await this.walletOperationRepository.sum('amount', this.mintedFrom(quote))) ?? 0;
	}

	/** The wallet's finished mints from a quote */
	private mintedFrom(quote: CashuWalletQuote): FindOptionsWhere<CashuWalletOperation> {
		return {mint_id: quote.mint_id, quote_id: quote.quote_id, type: WalletOperationType.MINT, state: WalletOperationState.FINALIZED};
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/** The receive rules for a method, refusing one the wallet can't receive by */
	private findMethod(method: string): CashuWalletQuoteMethod {
		if (!Object.hasOwn(CASHU_WALLET_QUOTE_METHODS, method)) throw walletError(`Can't receive by ${method}`);
		return CASHU_WALLET_QUOTE_METHODS[method as keyof typeof CASHU_WALLET_QUOTE_METHODS];
	}

	/** Key that serializes creating quotes at one wallet mint, method and unit */
	private createKey({user_id, mint_id, method, unit}: CashuWalletQuoteRequest): string {
		return `create:${user_id}:${mint_id}:${method}:${unit}`;
	}

	/** Run work one at a time per key; a caller waits for the work before it, whether that succeeded or failed */
	private serially<T>(key: string, work: () => Promise<T>): Promise<T> {
		const previous = this.running.get(key) ?? Promise.resolve();
		const run = previous.catch(() => undefined).then(work);
		const settled = run.catch(() => undefined);
		this.running.set(key, settled);
		void settled.then(() => {
			if (this.running.get(key) === settled) this.running.delete(key);
		});
		return run;
	}
}
