/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
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
import {CashuWalletMintQuote} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.entity';
import {CashuWalletMintCacheService} from '#server/modules/cashu/wallet/mint/cashuwalletmintcache.service';
import {CashuWalletMintTransportService} from '#server/modules/cashu/wallet/mint/cashuwalletminttransport.service';
import {WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import type {CashuWalletMeltQuoteRequest} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletMeltService} from './cashuwalletmelt.service.js';

const ORCHARD_API = 'http://localhost:3338';
const CEDAR = 'https://203.0.113.10';
const EXPIRY = 2_000_000_000;

describe('CashuWalletMeltService', () => {
	let service: CashuWalletMeltService;
	let issue: CashuWalletIssueService;
	let mint_service: CashuWalletMintService;
	let data_source: DataSource;
	let mints: Map<string, FakeMint>;

	const fetch_service = {fetchWithProxy: jest.fn(fakeMintFetch((origin) => mints.get(origin)!))};

	const orchard = () => mints.get(ORCHARD_API)!;
	const cedar = () => mints.get(CEDAR)!;
	/** The bodies of the melt quote requests sent for a method */
	const meltQuotesSent = (method: string) =>
		fetch_service.fetchWithProxy.mock.calls
			.filter(([url]) => url.endsWith(`/v1/melt/quote/${method}`))
			.map(([, options]) => JSON.parse(options.body!));

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
		mints = new Map([
			[ORCHARD_API, createFakeMint()],
			[CEDAR, createFakeMint({pubkey: '02cedar', input_fee_ppk: 1000})],
		]);
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMeltService,
				CashuWalletIssueService,
				CashuWalletJournalService,
				CashuWalletProofService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				CashuWalletMintTransportService,
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

		it('refuses when the balance cannot cover the fees, without asking the mint', async () => {
			const mint_id = await orchardMint();
			await expect(quote(mint_id, {method: 'bolt12', request: 'lno1fake', max: true})).rejects.toEqual(
				walletError('Not enough here to cover the fees'),
			);
			expect(meltQuotesSent('bolt12')).toHaveLength(0);
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
