/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {Wallet} from '@cashu/cashu-ts';
/* Application Dependencies */
import {createFakeMint, fakeMintFetch, type FakeMint} from '#server/test/cashu-fake-mint';
import {createFakeChain, type FakeChain} from '#server/test/bitcoin-fake-chain';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {UserService} from '#server/modules/user/user.service';
/* Native Dependencies */
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletCounter} from '#server/modules/cashu/wallet/saga/cashuwalletcounter.entity';
import {CashuWalletProof} from '#server/modules/cashu/wallet/proof/cashuwalletproof.entity';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {CashuWalletSeedService} from '#server/modules/cashu/wallet/seed/cashuwalletseed.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletMint} from '#server/modules/cashu/wallet/mint/cashuwalletmint.entity';
import {CashuWalletMintInfo} from '#server/modules/cashu/wallet/mint/cashuwalletmintinfo.entity';
import {CashuWalletMintKeyset} from '#server/modules/cashu/wallet/mint/cashuwalletmintkeyset.entity';
import {CashuWalletMintQuote} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.entity';
import {CashuWalletMintQuoteService} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.service';
import {CashuWalletMintCacheService} from '#server/modules/cashu/wallet/mint/cashuwalletmintcache.service';
import {CashuWalletMintTransportService} from '#server/modules/cashu/wallet/mint/cashuwalletminttransport.service';
import {CashuWalletChainService} from '#server/modules/cashu/wallet/chain/cashuwalletchain.service';
import {CashuWalletUnsentError} from '#server/modules/cashu/wallet/classes/cashu-wallet-unsent-error.class';
import {WalletOperationState, WalletOperationType, WalletProofState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import type {CashuWalletMeltQuoteRequest, CashuWalletMeltRequest} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletMeltService} from './cashuwalletmelt.service.js';

const ORCHARD_API = 'http://localhost:3338';
const CEDAR = 'https://203.0.113.10';
const EXPIRY = 2_000_000_000;
const PREIMAGE = '00'.repeat(32);
const OUTPOINT = `${'ab'.repeat(32)}:0`;

describe('CashuWalletMeltService', () => {
	let service: CashuWalletMeltService;
	let issue: CashuWalletIssueService;
	let recovery: CashuWalletRecoveryService;
	let mint_service: CashuWalletMintService;
	let data_source: DataSource;
	let mints: Map<string, FakeMint>;
	let chain: FakeChain;

	const fetchMints = fakeMintFetch((origin) => mints.get(origin)!);
	const fetch_service = {fetchWithProxy: jest.fn(fetchMints)};

	const orchard = () => mints.get(ORCHARD_API)!;
	const cedar = () => mints.get(CEDAR)!;
	const callsTo = (path: string) => fetch_service.fetchWithProxy.mock.calls.filter(([url]) => url.endsWith(path));
	/** The bodies of the melt quote requests sent for a method */
	const meltQuotesSent = (method: string) => callsTo(`/v1/melt/quote/${method}`).map(([, options]) => JSON.parse(options.body!));
	/** The bodies of the melts sent for a method */
	const meltsSent = (method: string) => callsTo(`/v1/melt/${method}`).map(([, options]) => JSON.parse(options.body!));
	const balance = async () =>
		(await data_source.getRepository(CashuWalletProof).findBy({user_id: 'user-1', state: WalletProofState.READY})).reduce(
			(sum, proof) => sum + proof.amount,
			0,
		);
	const reload = (id: string) => data_source.getRepository(CashuWalletOperation).findOneByOrFail({id});

	/** Mint ecash into user-1's wallet through a quote already paid */
	const fund = async (mint_id: string, amount: number, fake = orchard()) => {
		const quote_id = `fund-${fake.mint_quotes.size + 1}`;
		fake.mint_quotes.set(quote_id, {state: 'PAID', amount, expiry: null});
		const operation = await issue.createMintOperation({
			user_id: 'user-1',
			mint_id,
			type: WalletOperationType.MINT,
			unit: 'sat',
			amount,
			method: 'bolt11',
			quote_id,
			quote_counter: null,
			memo: null,
		});
		await issue.executeMintOperation(operation.id);
	};
	const orchardMint = async () => (await mint_service.getOrchardMint('user-1')).id;
	/** user-1's Orchard mint, funded */
	const funded = async (amount = 100) => {
		const mint_id = await orchardMint();
		await fund(mint_id, amount);
		return mint_id;
	};
	const quote = (mint_id: string, changes: Partial<CashuWalletMeltQuoteRequest> = {}) =>
		service.newQuote({
			user_id: 'user-1',
			mint_id,
			method: 'bolt11',
			unit: 'sat',
			request: 'lnbc100n1fake',
			amount: null,
			max: false,
			...changes,
		});
	const pay = (mint_id: string, quote_id: string, changes: Partial<CashuWalletMeltRequest> = {}) =>
		service.payQuote({user_id: 'user-1', mint_id, method: 'bolt11', unit: 'sat', quote_id, fee_index: null, ...changes});
	const quoteAddress = (mint_id: string) => quote(mint_id, {method: 'onchain', request: 'bcrt1qfake', amount: 50});

	const entities = [
		CashuWalletOperation,
		CashuWalletProof,
		CashuWalletCounter,
		CashuWalletMint,
		CashuWalletMintInfo,
		CashuWalletMintKeyset,
		CashuWalletMintQuote,
	];

	beforeEach(async () => {
		jest.clearAllMocks();
		fetch_service.fetchWithProxy.mockImplementation(fetchMints);
		mints = new Map([
			[ORCHARD_API, createFakeMint()],
			[CEDAR, createFakeMint({pubkey: '02cedar', input_fee_ppk: 1000})],
		]);
		chain = createFakeChain();
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMeltService,
				CashuWalletIssueService,
				CashuWalletSwapService,
				CashuWalletRecoveryService,
				CashuWalletMintQuoteService,
				CashuWalletJournalService,
				CashuWalletProofService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				CashuWalletMintTransportService,
				CashuWalletChainService,
				{provide: BitcoinRpcService, useValue: chain.rpc},
				{provide: CashuWalletSeedService, useValue: {getSeed: jest.fn(async () => new Uint8Array(64).fill(7))}},
				{provide: ConfigService, useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? ORCHARD_API : undefined))}},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuMintRpcService, useValue: {updateNut04Quote: jest.fn()}},
				{provide: EventEmitter2, useValue: new EventEmitter2()},
				{provide: UserService, useValue: {getUserById: jest.fn()}},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		service = module.get(CashuWalletMeltService);
		issue = module.get(CashuWalletIssueService);
		recovery = module.get(CashuWalletRecoveryService);
		mint_service = module.get(CashuWalletMintService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	describe('pricing', () => {
		it('quotes an invoice for its own amount, priced against the balance with the reserve on top', async () => {
			const mint_id = await funded();
			expect(await quote(mint_id)).toEqual({
				quote_id: 'melt-1',
				amount: 10,
				expiry: EXPIRY,
				balance: 100,
				fees: [{fee_index: null, estimated_blocks: null, fee: 2, total: 12, sufficient: true}],
			});
			expect(meltQuotesSent('bolt11')).toEqual([{unit: 'sat', request: 'lnbc100n1fake'}]);
		});

		it('sends the amount in msat for an invoice that sets none, trimming the request', async () => {
			const mint_id = await funded();
			expect(await quote(mint_id, {request: '  lnbc1fake\n', amount: 25})).toMatchObject({amount: 25});
			expect(meltQuotesSent('bolt11')).toEqual([{unit: 'sat', request: 'lnbc1fake', options: {amountless: {amount_msat: 25_000}}}]);
		});

		it('prices each onchain speed the mint offers', async () => {
			const mint_id = await funded();
			const melt = await quote(mint_id, {method: 'onchain', request: 'bcrt1qfake', amount: 50});
			expect(melt.fees).toEqual([
				{fee_index: 0, estimated_blocks: 1, fee: 6, total: 56, sufficient: true},
				{fee_index: 1, estimated_blocks: 6, fee: 4, total: 54, sufficient: true},
				{fee_index: 2, estimated_blocks: 144, fee: 2, total: 52, sufficient: true},
			]);
		});

		it('reports a balance short of the total instead of refusing', async () => {
			const mint_id = await funded(10);
			expect(await quote(mint_id)).toMatchObject({balance: 10, fees: [{total: 12, sufficient: false}]});
		});

		it('adds the input fee of the proofs the payment would spend on a fee-charging keyset', async () => {
			const mint_id = (await mint_service.addMint('user-1', CEDAR)).id;
			await fund(mint_id, 100, cedar());
			expect(await quote(mint_id, {request: 'lnbc950n1fake'})).toMatchObject({
				amount: 95,
				fees: [{fee: 5, total: 100, sufficient: true}],
			});
		});
	});

	describe('max', () => {
		it('quotes the most the balance pays, quoting again once the reserve is known', async () => {
			const mint_id = await funded();
			expect(await quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).toMatchObject({
				amount: 98,
				fees: [{fee: 2, total: 100, sufficient: true}],
			});
			expect(meltQuotesSent('bolt12').map((body) => body.options.amountless.amount_msat)).toEqual([100_000, 98_000]);
		});

		it('fits the most expensive onchain speed, so every speed stays affordable', async () => {
			const mint_id = await funded();
			const melt = await quote(mint_id, {method: 'onchain', request: 'bcrt1qfake', max: true});
			expect(melt).toMatchObject({amount: 94});
			expect(melt.fees.map(({total, sufficient}) => [total, sufficient])).toEqual([
				[100, true],
				[98, true],
				[96, true],
			]);
		});

		it("stays within the method's max_amount", async () => {
			orchard().info.nuts[5].methods[1].max_amount = 50;
			const mint_id = await funded();
			expect(await quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).toMatchObject({amount: 50});
		});

		it('stops after three quotes at a mint whose reserve keeps growing, reporting the last as short', async () => {
			const mint_id = await funded();
			orchard().melt_quote_defaults.fee_reserve = (amount) => 110 - amount;
			expect(await quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).toMatchObject({
				amount: 80,
				fees: [{sufficient: false}],
			});
			expect(meltQuotesSent('bolt12')).toHaveLength(3);
		});

		it('takes the first quote when the mint sets the amount itself, as for a fixed-amount offer', async () => {
			const mint_id = await funded(50);
			orchard().melt_quote_defaults.amount = 60;
			expect(await quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).toMatchObject({
				amount: 60,
				fees: [{sufficient: false}],
			});
			expect(meltQuotesSent('bolt12')).toHaveLength(1);
		});

		it('refuses max from an empty wallet without asking the mint', async () => {
			const mint_id = await orchardMint();
			await expect(quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).rejects.toEqual(
				walletError('No ecash at this mint'),
			);
			expect(meltQuotesSent('bolt12')).toHaveLength(0);
		});

		it('refuses when the balance cannot cover the fees, without asking the mint', async () => {
			const mint_id = (await mint_service.addMint('user-1', CEDAR)).id;
			await fund(mint_id, 1, cedar());
			await expect(quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).rejects.toEqual(
				walletError('Not enough here to cover the fees'),
			);
			expect(meltQuotesSent('bolt12')).toHaveLength(0);
		});
	});

	describe('pay', () => {
		it('pays an invoice, keeping its change and preimage, at the fee the mint charged', async () => {
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			expect(await pay(mint_id, quote_id)).toMatchObject({
				type: WalletOperationType.MELT,
				state: WalletOperationState.FINALIZED,
				amount: 10,
				fee_reserve: 2,
				fee: 1,
				request: 'lnbc100n1fake',
				payment_proof: PREIMAGE,
				error: null,
			});
			expect(meltsSent('bolt11')).toEqual([expect.objectContaining({quote: quote_id, prefer_async: true})]);
			expect(await balance()).toBe(89);
		});

		it('pays an address at the speed chosen, sending it with the melt', async () => {
			const mint_id = await funded();
			const {quote_id} = await quoteAddress(mint_id);
			expect(await pay(mint_id, quote_id, {method: 'onchain', fee_index: 1})).toMatchObject({
				state: WalletOperationState.FINALIZED,
				fee_index: 1,
				fee_reserve: 4,
				fee: 2,
				payment_proof: OUTPOINT,
			});
			expect(meltsSent('onchain')).toEqual([expect.objectContaining({fee_index: 1})]);
			expect(await balance()).toBe(48);
		});

		it('counts the input fee in what a fee-charging keyset pays', async () => {
			const mint_id = (await mint_service.addMint('user-1', CEDAR)).id;
			await fund(mint_id, 100, cedar());
			const {quote_id} = await quote(mint_id, {request: 'lnbc950n1fake'});
			expect(await pay(mint_id, quote_id)).toMatchObject({state: WalletOperationState.FINALIZED, fee: 4});
			expect(await balance()).toBe(1);
		});

		it.each<[string, (mint_id: string) => Promise<unknown>, string]>([
			[
				'onchain without a speed',
				async (mint_id) => pay(mint_id, (await quoteAddress(mint_id)).quote_id, {method: 'onchain'}),
				'Pick a speed for onchain',
			],
			[
				'a speed for Lightning',
				async (mint_id) => pay(mint_id, (await quote(mint_id)).quote_id, {fee_index: 0}),
				'No speed 0 for this melt quote',
			],
			[
				'an expired quote',
				async (mint_id) => {
					orchard().melt_quote_defaults.expiry = 1;
					return pay(mint_id, (await quote(mint_id)).quote_id);
				},
				'Melt quote expired; get a new one',
			],
			[
				'more than the balance holds',
				async (mint_id) => pay(mint_id, (await quote(mint_id, {request: 'lnbc1000n1fake'})).quote_id),
				'Not enough here to pay 102 sat',
			],
		])('refuses %s before anything is saved', async (_label, attempt, details) => {
			const mint_id = await funded();
			await expect(attempt(mint_id)).rejects.toEqual(walletError(details));
			expect(await data_source.getRepository(CashuWalletOperation).countBy({type: WalletOperationType.MELT})).toBe(0);
			expect([...meltsSent('bolt11'), ...meltsSent('onchain')]).toHaveLength(0);
			expect(await balance()).toBe(100);
		});

		it('refuses a quote already paid, and a request while a payment of it is still open', async () => {
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			await pay(mint_id, quote_id);
			await expect(pay(mint_id, quote_id)).rejects.toEqual(walletError('Melt quote already paid'));

			orchard().melt_defaults.pending = true;
			const first = await quote(mint_id, {request: 'lnbc200n1fake'});
			expect(await pay(mint_id, first.quote_id)).toMatchObject({state: WalletOperationState.PENDING});
			const again = await quote(mint_id, {request: 'lnbc200n1fake'});
			await expect(pay(mint_id, again.quote_id)).rejects.toEqual(walletError('Already paying this request'));
			expect(meltsSent('bolt11')).toHaveLength(2);
		});

		it('waits on a melt the mint pays later, through outages, finishing it with its change once paid and never sending it again', async () => {
			orchard().melt_defaults.pending = true;
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			const paying = await pay(mint_id, quote_id);
			expect(paying).toMatchObject({state: WalletOperationState.PENDING, payment_proof: null, error: null});

			orchard().outages.set(`/v1/melt/quote/bolt11/${quote_id}`, 503);
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({state: WalletOperationState.PENDING, error: 'Unavailable (HTTP 503)'});
			orchard().outages.clear();
			orchard().settleMelt(quote_id, 'PAID');
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({
				state: WalletOperationState.FINALIZED,
				fee: 1,
				payment_proof: PREIMAGE,
				error: null,
			});
			expect(meltsSent('bolt11')).toHaveLength(1);
			expect(await balance()).toBe(89);
		});

		it('gives the inputs back once the mint reports a pending melt unpaid, as when an onchain send fails to broadcast', async () => {
			orchard().melt_defaults.pending = true;
			const mint_id = await funded();
			const {quote_id} = await quoteAddress(mint_id);
			const paying = await pay(mint_id, quote_id, {method: 'onchain', fee_index: 2});
			orchard().settleMelt(quote_id, 'UNPAID');
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({state: WalletOperationState.FAILED, error: 'Payment failed'});
			expect(await balance()).toBe(100);
		});

		it("follows the confirmations Orchard's node sees on an onchain melt the mint broadcast, keeping the count while the node is down", async () => {
			orchard().melt_defaults.pending = true;
			const mint_id = await funded();
			const {quote_id} = await quoteAddress(mint_id);
			const paying = await pay(mint_id, quote_id, {method: 'onchain', fee_index: 1});
			expect(paying).toMatchObject({state: WalletOperationState.PENDING, payment_proof: null, confirmations: null});

			orchard().broadcastMelt(quote_id);
			chain.outputs.set(OUTPOINT, 0);
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({state: WalletOperationState.PENDING, payment_proof: OUTPOINT, confirmations: 0});

			chain.outputs.set(OUTPOINT, 2);
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({confirmations: 2});

			chain.down = true;
			await recovery.reconcileOperations();
			expect(await reload(paying.id)).toMatchObject({state: WalletOperationState.PENDING, confirmations: 2});
		});

		it.each([
			['with the change its quote check carries', true, 0],
			['restoring change its quote check leaves out from the seed', false, 1],
		])('never sends a melt whose response was lost again, finishing it from the quote %s', async (_label, quote_change, restores) => {
			orchard().melt_defaults.quote_change = quote_change;
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			orchard().lost.add('/v1/melt/bolt11');
			expect(await pay(mint_id, quote_id)).toMatchObject({state: WalletOperationState.FINALIZED, fee: 1, payment_proof: PREIMAGE});
			expect(meltsSent('bolt11')).toHaveLength(1);
			expect(callsTo('/v1/restore')).toHaveLength(restores);
			expect(await balance()).toBe(89);
		});

		it('leaves a melt still on its way to the mint alone while recovery runs', async () => {
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			let sent!: () => void;
			let arrive!: () => void;
			const melt_sent = new Promise<void>((resolve) => (sent = resolve));
			const on_its_way = new Promise<void>((resolve) => (arrive = resolve));
			fetch_service.fetchWithProxy.mockImplementation(async (url, options) => {
				if (url.endsWith('/v1/melt/bolt11')) {
					sent();
					await on_its_way;
				}
				return fetchMints(url, options);
			});
			const paying = pay(mint_id, quote_id);
			await melt_sent;
			await recovery.reconcileOperations();
			expect(await data_source.getRepository(CashuWalletOperation).findOneByOrFail({type: WalletOperationType.MELT})).toMatchObject({
				state: WalletOperationState.EXECUTING,
				error: null,
			});
			arrive();
			expect(await paying).toMatchObject({state: WalletOperationState.FINALIZED});
			expect(await balance()).toBe(89);
		});

		it('gives the inputs back when the mint refuses the melt outright, quoting its reason', async () => {
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			orchard().failures.push({code: 11014, detail: 'Max inputs exceeded'});
			expect(await pay(mint_id, quote_id)).toMatchObject({
				state: WalletOperationState.FAILED,
				error: 'Mint error 11014: Max inputs exceeded',
			});
			expect(await balance()).toBe(100);
		});

		it('fails a first attempt Orchard holds back at once, with its balance back and no quote check', async () => {
			const mint_id = await funded();
			const {quote_id} = await quote(mint_id);
			const held_back = 'too many requests; try again shortly';
			jest.spyOn(Wallet.prototype, 'completeMelt').mockRejectedValueOnce(new CashuWalletUnsentError(held_back));
			expect(await pay(mint_id, quote_id)).toMatchObject({state: WalletOperationState.FAILED, error: held_back});
			expect(callsTo(`/v1/melt/quote/bolt11/${quote_id}`)).toHaveLength(1);
			expect(await balance()).toBe(100);
		});
	});

	describe('refusals', () => {
		it.each<[string, Partial<CashuWalletMeltQuoteRequest>, string]>([
			['an onchain payment without an amount', {method: 'onchain', request: 'bcrt1qfake'}, 'An amount is required for onchain'],
			['a method the wallet does not pay by', {method: 'custom'}, "Can't pay by custom"],
			['a Lightning amount in a unit other than sat or msat', {unit: 'usd', amount: 25}, "Can't set a bolt11 amount in usd"],
			[
				'max on Lightning in a unit other than sat or msat',
				{method: 'bolt12', unit: 'usd', max: true},
				"Can't set a bolt12 amount in usd",
			],
			["another user's mint", {user_id: 'user-2'}, 'Mint not found in this wallet'],
		])('refuses %s', async (_label, changes, details) => {
			const mint_id = await funded();
			await expect(quote(mint_id, changes)).rejects.toEqual(walletError(details));
			expect(meltQuotesSent(changes.method ?? 'bolt11')).toHaveLength(0);
		});
	});
});
