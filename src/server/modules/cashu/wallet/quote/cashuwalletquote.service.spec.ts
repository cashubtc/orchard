/* Core Dependencies */
import {Test} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {createFakeMint, fakeMintFetch, type FakeMint} from '#server/test/cashu-fake-mint';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {UserService} from '#server/modules/user/user.service';
/* Native Dependencies */
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletCounter} from '#server/modules/cashu/wallet/saga/cashuwalletcounter.entity';
import {CashuWalletProof} from '#server/modules/cashu/wallet/proof/cashuwalletproof.entity';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {CashuWalletSeedService} from '#server/modules/cashu/wallet/seed/cashuwalletseed.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletMint} from '#server/modules/cashu/wallet/mint/cashuwalletmint.entity';
import {CashuWalletMintInfo} from '#server/modules/cashu/wallet/mint/cashuwalletmintinfo.entity';
import {CashuWalletMintKeyset} from '#server/modules/cashu/wallet/mint/cashuwalletmintkeyset.entity';
import {CashuWalletMintCacheService} from '#server/modules/cashu/wallet/mint/cashuwalletmintcache.service';
import {CashuWalletMintTransportService} from '#server/modules/cashu/wallet/mint/cashuwalletminttransport.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {CASHU_WALLET_QUOTE_UPDATED} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import type {
	CashuWalletOperationUpdate,
	CashuWalletQuoteRecord,
	CashuWalletQuoteRequest,
} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletQuoteService} from './cashuwalletquote.service.js';
import {CashuWalletQuote} from './cashuwalletquote.entity.js';

describe('CashuWalletQuoteService', () => {
	let service: CashuWalletQuoteService;
	let issue: CashuWalletIssueService;
	let emitter: EventEmitter2;
	let data_source: DataSource;
	let mint: FakeMint;
	let mint_row: CashuWalletMint;
	let offline: boolean;

	const fetch_service = {
		fetchWithProxy: jest.fn(
			fakeMintFetch(
				() => mint,
				() => offline,
			),
		),
	};
	const seeds: Record<string, Uint8Array> = {'user-1': new Uint8Array(64).fill(7), 'user-2': new Uint8Array(64).fill(9)};
	const entities = [
		CashuWalletOperation,
		CashuWalletProof,
		CashuWalletCounter,
		CashuWalletMint,
		CashuWalletMintInfo,
		CashuWalletMintKeyset,
		CashuWalletQuote,
	];

	const now = () => DateTime.now().toUnixInteger();
	const request = (method: string, changes: Partial<CashuWalletQuoteRequest> = {}): CashuWalletQuoteRequest => ({
		user_id: 'user-1',
		mint_id: mint_row.id,
		method,
		unit: 'sat',
		amount: method === 'bolt11' ? 100 : null,
		description: null,
		...changes,
	});
	const open = (method: string) => service.openQuote('user-1', mint_row.id, method, 'sat');
	/** Amounts the wallet minted from a quote, smallest first */
	const minted = async (quote_id: string) =>
		(await data_source.getRepository(CashuWalletOperation).findBy({quote_id, type: WalletOperationType.MINT}))
			.filter((operation) => operation.state === WalletOperationState.FINALIZED)
			.map((operation) => operation.amount)
			.sort((a, b) => a - b);
	const requests = (path: RegExp) => fetch_service.fetchWithProxy.mock.calls.filter(([url]) => path.test(url)).length;
	const checksOf = (quote_id: string) => requests(new RegExp(`/v1/mint/quote/\\w+/${quote_id}$`));

	beforeEach(async () => {
		jest.clearAllMocks();
		mint = createFakeMint();
		offline = false;
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		mint_row = await data_source.getRepository(CashuWalletMint).save({
			user_id: 'user-1',
			pubkey: '02orchard',
			urls: ['https://mint.orchard.example'],
			created_at: 0,
		});
		const module = await Test.createTestingModule({
			providers: [
				CashuWalletQuoteService,
				CashuWalletIssueService,
				CashuWalletJournalService,
				CashuWalletProofService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				CashuWalletMintTransportService,
				{provide: CashuWalletSeedService, useValue: {getSeed: jest.fn(async (user_id: string) => seeds[user_id])}},
				{
					provide: ConfigService,
					useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? 'http://localhost:3338' : undefined))},
				},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuMintRpcService, useValue: {}},
				{provide: EventEmitter2, useValue: new EventEmitter2()},
				{provide: UserService, useValue: {getUserById: jest.fn()}},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		service = module.get(CashuWalletQuoteService);
		issue = module.get(CashuWalletIssueService);
		emitter = module.get(EventEmitter2);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	describe('bolt11', () => {
		it('gives a new locked invoice each time and mints it in full once paid, then stops checking it', async () => {
			const invoice = await service.newQuote(request('bolt11', {description: 'Lunch'}));
			const other = await service.newQuote(request('bolt11'));
			expect(other.id).not.toBe(invoice.id);
			expect(invoice).toMatchObject({
				amount: 100,
				latest: false,
				quote_counter: 0,
				request: 'lnbc1000n1fake',
				received: 0,
				payments: 0,
			});
			expect(mint.quotes.get(invoice.quote_id)).toMatchObject({pubkey: expect.stringMatching(/^0[23][0-9a-f]{64}$/)});

			mint.pay(invoice.quote_id);
			await service.checkQuotes();
			expect(await minted(invoice.quote_id)).toEqual([100]);
			const [operation] = await data_source.getRepository(CashuWalletOperation).findBy({quote_id: invoice.quote_id});
			expect(operation).toMatchObject({type: WalletOperationType.MINT, method: 'bolt11', memo: null});

			const checks = checksOf(invoice.quote_id);
			await service.checkQuotes();
			expect(checksOf(invoice.quote_id)).toBe(checks);
			expect(checksOf(other.quote_id)).toBe(2);
		});

		it('stops checking an invoice once recovery finishes minting it', async () => {
			const invoice = await service.newQuote(request('bolt11'));
			mint.pay(invoice.quote_id);
			mint.outages.set('/v1/mint/bolt11', 503);
			await service.checkQuotes();
			const [operation] = await data_source.getRepository(CashuWalletOperation).findBy({quote_id: invoice.quote_id});
			expect(operation.state).toBe(WalletOperationState.EXECUTING);

			mint.outages.clear();
			await issue.executeMintOperation(operation.id);
			await service.checkQuotes();
			const checks = checksOf(invoice.quote_id);
			await service.checkQuotes();
			expect(checksOf(invoice.quote_id)).toBe(checks);
			expect(await minted(invoice.quote_id)).toEqual([100]);
		});

		it.each([
			['drops a description the mint does not take', undefined, null],
			['puts the description on the invoice when the mint takes one', {description: true}, 'Lunch'],
		])('%s', async (_label, options, description) => {
			mint.info.nuts[4].methods[0].options = options;
			const invoice = await service.newQuote(request('bolt11', {description: 'Lunch'}));
			expect(invoice.description).toBe(description);
			expect(mint.quotes.get(invoice.quote_id)!.description).toBe(description ?? undefined);
		});

		it('leaves nothing in the wallet for an invoice that expires unpaid, checking it only for an hour after', async () => {
			mint.quote_defaults.expiry = now() - 2 * 60 * 60;
			const lapsed = await service.newQuote(request('bolt11'));
			mint.quote_defaults.expiry = now() - 30 * 60;
			const recent = await service.newQuote(request('bolt11'));
			await service.checkQuotes();
			expect([checksOf(lapsed.quote_id), checksOf(recent.quote_id)]).toEqual([0, 1]);
			expect(await data_source.getRepository(CashuWalletOperation).count()).toBe(0);
		});
	});

	describe('bolt12', () => {
		it('reuses an unpaid offer with the same terms, and makes a new one for other terms or once it is paid', async () => {
			const offer = await service.newQuote(request('bolt12'));
			expect(offer).toMatchObject({amount: null, latest: true, request: expect.stringMatching(/^lno1/)});
			expect(await service.newQuote(request('bolt12'))).toMatchObject({id: offer.id, latest: true});
			const coffee = await service.newQuote(request('bolt12', {description: 'Coffee'}));
			expect(coffee).toMatchObject({description: 'Coffee', latest: true});
			expect(coffee.id).not.toBe(offer.id);

			mint.pay(offer.quote_id, 30);
			const fresh = await service.newQuote(request('bolt12'));
			expect(fresh.id).not.toBe(offer.id);
			expect(await minted(offer.quote_id)).toEqual([30]);
			expect(await data_source.getRepository(CashuWalletQuote).findBy({latest: true})).toEqual([
				expect.objectContaining({id: fresh.id}),
			]);
		});

		it('mints each payment to an offer as its own operation', async () => {
			const offer = await service.newQuote(request('bolt12'));
			mint.pay(offer.quote_id, 30);
			await service.checkQuotes();
			mint.pay(offer.quote_id, 20);
			await service.checkQuotes();
			expect(await minted(offer.quote_id)).toEqual([20, 30]);
			expect(await open('bolt12')).toMatchObject({id: offer.id, amount_paid: 50, received: 50, payments: 2});
		});

		it('never mints twice when the mint and the quote both lag behind what the wallet minted', async () => {
			const offer = await service.newQuote(request('bolt12'));
			mint.pay(offer.quote_id, 50);
			await service.checkQuotes();
			mint.quotes.get(offer.quote_id)!.amount_issued = 0;
			await data_source.getRepository(CashuWalletQuote).update({id: offer.id}, {amount_issued: 0});
			await service.checkQuotes();
			expect(await minted(offer.quote_id)).toEqual([50]);
		});
	});

	describe('onchain', () => {
		it('opens on an unpaid address again, and on a fresh one once it was paid', async () => {
			const address = await open('onchain');
			expect(address).toMatchObject({method: 'onchain', amount: null, latest: true, request: expect.stringMatching(/^bcrt1q/)});
			expect((await open('onchain')).id).toBe(address.id);
			expect((await service.newQuote(request('onchain'))).id).toBe(address.id);

			mint.pay(address.quote_id, 1_000);
			const fresh = await open('onchain');
			expect(fresh.id).not.toBe(address.id);
			expect(await minted(address.quote_id)).toEqual([1_000]);
		});

		it("mints a deposit above the mint's max_amount in pieces", async () => {
			mint.info.nuts[4].methods[2].max_amount = 600;
			const address = await open('onchain');
			mint.pay(address.quote_id, 1_000);
			await service.checkQuotes();
			expect(await minted(address.quote_id)).toEqual([400, 600]);
		});
	});

	it.each([
		['onchain', [500]],
		['bolt12', []],
	])('keeps checking an older %s quote past its expiry for its grace', async (method, expected) => {
		mint.quote_defaults.expiry = now() - 2 * 24 * 60 * 60;
		const older = await service.newQuote(request(method));
		mint.quote_defaults.expiry = null;
		expect((await service.newQuote(request(method))).id).not.toBe(older.id);
		mint.pay(older.quote_id, 500);
		await service.checkQuotes();
		expect(await minted(older.quote_id)).toEqual(expected);
	});

	it('stops checking a latest offer once its window has passed, but keeps checking a latest one that never expires', async () => {
		mint.quote_defaults.expiry = now() - 2 * 60 * 60;
		const expired = await service.newQuote(request('bolt12'));
		mint.quote_defaults.expiry = null;
		const lasting = await service.newQuote(request('onchain'));
		await data_source.getRepository(CashuWalletQuote).update({id: lasting.id}, {check_until: now() - 60});
		await service.checkQuotes();
		expect([checksOf(expired.quote_id), checksOf(lasting.quote_id)]).toEqual([0, 1]);
	});

	it("checks exactly the quotes that aren't final, so the pass and the final flag never disagree", async () => {
		const quotes = data_source.getRepository(CashuWalletQuote);
		const past = now() - 60;
		const lasting = await service.newQuote(request('onchain'));
		await quotes.update({id: lasting.id}, {check_until: past});
		const inside = await service.newQuote(request('bolt12', {description: 'Inside'}));
		const owed = await service.newQuote(request('bolt12', {description: 'Owed'}));
		mint.pay(owed.quote_id, 10);
		await quotes.update({id: owed.id}, {amount_paid: 10, check_until: past});
		const lapsed = await service.newQuote(request('bolt12', {description: 'Lapsed'}));
		await quotes.update({id: lapsed.id}, {check_until: past});
		const expiring = await service.newQuote(request('bolt12', {description: 'Expiring'}));
		await quotes.update({id: expiring.id}, {expiry: past - 60 * 60, check_until: past});
		const invoice = await service.newQuote(request('bolt11'));
		await quotes.update({id: invoice.id}, {amount_paid: 100, amount_issued: 100, check_until: past});

		const all = [lasting, inside, owed, lapsed, expiring, invoice];
		const open: string[] = [];
		for (const quote of all) if (!(await service.getQuote('user-1', quote.id)).final) open.push(quote.id);
		await service.checkQuotes();
		expect(all.filter((quote) => checksOf(quote.quote_id) > 0).map((quote) => quote.id)).toEqual(open);
		expect(open).toEqual([lasting.id, inside.id, owed.id]);
	});

	it('still mints a payment it saw before a quote stopped being checked', async () => {
		mint.quote_defaults.expiry = now() - 2 * 24 * 60 * 60;
		const older = await service.newQuote(request('bolt12'));
		mint.quote_defaults.expiry = null;
		await service.newQuote(request('bolt12'));
		mint.pay(older.quote_id, 500);
		await data_source.getRepository(CashuWalletQuote).update({id: older.id}, {amount_paid: 500});
		await service.checkQuotes();
		expect(await minted(older.quote_id)).toEqual([500]);
	});

	it('hands out no quote with an hour or less left', async () => {
		mint.quote_defaults.expiry = now() + 30 * 60;
		const offer = await service.newQuote(request('bolt12'));
		expect((await service.newQuote(request('bolt12'))).id).not.toBe(offer.id);
	});

	it('makes one quote when two requests for it race', async () => {
		const [first, second] = await Promise.all([service.newQuote(request('onchain')), service.newQuote(request('onchain'))]);
		expect(second.id).toBe(first.id);
		expect(await data_source.getRepository(CashuWalletQuote).count()).toBe(1);
	});

	describe('watching', () => {
		let events: CashuWalletQuoteRecord[];
		/** Let fire-and-forget announcements land */
		const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

		beforeEach(() => {
			events = [];
			emitter.on(CASHU_WALLET_QUOTE_UPDATED, (record: CashuWalletQuoteRecord) => void events.push(record));
		});

		it("gives a user's own quote with what it brought in, and refuses another's", async () => {
			const offer = await service.newQuote(request('bolt12'));
			expect(await service.getQuote('user-1', offer.id)).toMatchObject({id: offer.id, received: 0, payments: 0, final: false});
			await expect(service.getQuote('user-2', offer.id)).rejects.toEqual(walletError('Quote not found'));
		});

		it('announces each change to a quote, saying it takes no more once its invoice is minted', async () => {
			const invoice = await service.newQuote(request('bolt11'));
			mint.pay(invoice.quote_id);
			await service.checkQuotes();
			await settled();
			expect(events.length).toBeGreaterThan(0);
			expect(events.every(({id}) => id === invoice.id)).toBe(true);
			expect(events).toContainEqual(expect.objectContaining({amount_paid: 100, received: 100, payments: 1, final: true}));
		});

		it('announces a quote again when one of its mints finishes, whichever path minted it', async () => {
			const offer = await service.newQuote(request('bolt12'));
			await settled();
			events = [];
			const finished = {type: WalletOperationType.MINT, state: WalletOperationState.FINALIZED, mint_id: mint_row.id};
			service.onOperationUpdated({...finished, quote_id: offer.quote_id} as CashuWalletOperationUpdate);
			service.onOperationUpdated({
				...finished,
				type: WalletOperationType.SEND,
				quote_id: offer.quote_id,
			} as CashuWalletOperationUpdate);
			await settled();
			expect(events).toEqual([expect.objectContaining({id: offer.id, final: false})]);
		});

		it('settles a quote from an update its mint pushed, asking the mint nothing', async () => {
			const invoice = await service.newQuote(request('bolt11'));
			mint.pay(invoice.quote_id);
			const [, update] = mint.handle(`/v1/mint/quote/bolt11/${invoice.quote_id}`, undefined);
			await service.settleUpdate(invoice.id, update);
			expect(await minted(invoice.quote_id)).toEqual([100]);
			expect(checksOf(invoice.quote_id)).toBe(0);
		});

		it('announces a quote that is done receiving instead of checking it, so its watchers stop', async () => {
			mint.quote_defaults.expiry = now() - 2 * 60 * 60;
			const lapsed = await service.newQuote(request('bolt11'));
			await settled();
			events = [];
			await service.settleQuotes([lapsed.id]);
			await settled();
			expect(events).toEqual([expect.objectContaining({id: lapsed.id, final: true})]);
			expect(checksOf(lapsed.quote_id)).toBe(0);
		});

		it('settles only the quotes asked for', async () => {
			const offer = await service.newQuote(request('bolt12'));
			const coffee = await service.newQuote(request('bolt12', {description: 'Coffee'}));
			await service.settleQuotes([]);
			await service.settleQuotes([offer.id]);
			expect([checksOf(offer.quote_id), checksOf(coffee.quote_id)]).toEqual([1, 0]);
		});
	});

	describe('checking', () => {
		beforeEach(() => {
			mint.info.nuts[29] = {methods: ['bolt12']};
		});

		it("checks every user's quotes at a mint in one NUT-29 batch", async () => {
			const their_mint = await data_source.getRepository(CashuWalletMint).save({
				user_id: 'user-2',
				pubkey: '02orchard',
				urls: ['https://mint.orchard.example'],
				created_at: 0,
			});
			const mine = await service.newQuote(request('bolt12'));
			const theirs = await service.newQuote(request('bolt12', {user_id: 'user-2', mint_id: their_mint.id}));
			mint.pay(mine.quote_id, 10);
			mint.pay(theirs.quote_id, 20);
			await service.checkQuotes();
			expect([requests(/\/bolt12\/check$/), checksOf(mine.quote_id), checksOf(theirs.quote_id)]).toEqual([1, 0, 0]);
			expect([await minted(mine.quote_id), await minted(theirs.quote_id)]).toEqual([[10], [20]]);
		});

		it('finds a quote the mint no longer knows by halving the batch, and still mints the rest', async () => {
			const offers = [];
			for (const description of ['One', 'Two', 'Three', 'Four']) {
				offers.push(await service.newQuote(request('bolt12', {description})));
			}
			for (const offer of offers) mint.pay(offer.quote_id, 10);
			mint.quotes.delete(offers[0].quote_id);
			await service.checkQuotes();
			expect(await Promise.all(offers.map((offer) => minted(offer.quote_id)))).toEqual([[], [10], [10], [10]]);
			expect([requests(/\/bolt12\/check$/), checksOf(offers[0].quote_id)]).toEqual([5, 1]);
		});

		it.each([
			['is unreachable', () => void (offline = true)],
			['answers with a proxy error page', () => void mint.outages.set('/v1/mint/quote/bolt12/check', 503)],
		])('leaves a mint that %s for the next pass, trying it once rather than once per quote', async (_label, fail) => {
			const offer = await service.newQuote(request('bolt12'));
			const coffee = await service.newQuote(request('bolt12', {description: 'Coffee'}));
			fail();
			await service.checkQuotes();
			expect([requests(/\/bolt12\/check$/), checksOf(offer.quote_id), checksOf(coffee.quote_id)]).toEqual([1, 0, 0]);
		});

		it('stops at the first quote of a mint it cannot reach that answers one quote at a time', async () => {
			delete mint.info.nuts[29];
			const offer = await service.newQuote(request('bolt12'));
			const coffee = await service.newQuote(request('bolt12', {description: 'Coffee'}));
			offline = true;
			await service.checkQuotes();
			expect(checksOf(offer.quote_id) + checksOf(coffee.quote_id)).toBe(1);
		});
	});

	it.each([
		['opening a bolt11 invoice', () => open('bolt11'), 'bolt11 quotes are one-off; create a new one'],
		[
			'a bolt11 invoice without an amount',
			() => service.newQuote(request('bolt11', {amount: null})),
			'An amount is required for bolt11',
		],
		['an amount on an onchain address', () => service.newQuote(request('onchain', {amount: 100})), 'onchain takes no amount'],
		['a method the wallet does not receive by', () => service.newQuote(request('custom')), "Can't receive by custom"],
		['a mint outside the wallet', () => service.newQuote(request('bolt12', {user_id: 'user-2'})), 'Mint not found in this wallet'],
	])('refuses %s', async (_label, call, message) => {
		await expect(call()).rejects.toEqual(walletError(message));
	});
});
