/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {Mint, Wallet, getEncodedToken, getTokenMetadata} from '@cashu/cashu-ts';
/* Application Dependencies */
import {createFakeMint, fakeMintFetch, fakeMintRequest, type FakeMint} from '#server/test/cashu-fake-mint';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {UserService} from '#server/modules/user/user.service';
/* Native Dependencies */
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
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
import {WalletMintMatch, WalletOperationState, WalletOperationType, WalletProofState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
/* Local Dependencies */
import {CashuWalletSwapService} from './cashuwalletswap.service.js';

const ORCHARD_API = 'http://localhost:3338';
const ORCHARD_URL = 'https://mint.orchard.example';
const CEDAR = 'https://203.0.113.10';

describe('CashuWalletSwapService', () => {
	let service: CashuWalletSwapService;
	let issue: CashuWalletIssueService;
	let recovery: CashuWalletRecoveryService;
	let mint_service: CashuWalletMintService;
	let data_source: DataSource;
	let mints: Map<string, FakeMint>;
	let offline: boolean;

	const fetch_service = {
		fetchWithProxy: jest.fn(
			fakeMintFetch(
				(origin) => mints.get(origin)!,
				() => offline,
			),
		),
	};
	const seeds: Record<string, Uint8Array> = {'user-1': new Uint8Array(64).fill(7), 'user-2': new Uint8Array(64).fill(9)};

	const orchard = () => mints.get(ORCHARD_API)!;
	const cedar = () => mints.get(CEDAR)!;
	const orchardMint = async (user_id = 'user-1') => (await mint_service.getOrchardMint(user_id)).id;
	const sumOf = async (user_id: string, state: WalletProofState) =>
		(await data_source.getRepository(CashuWalletProof).findBy({user_id, state})).reduce((sum, proof) => sum + proof.amount, 0);
	const balance = (user_id = 'user-1') => sumOf(user_id, WalletProofState.READY);
	const held = (user_id = 'user-1') => sumOf(user_id, WalletProofState.HELD);
	const reload = (id: string) => data_source.getRepository(CashuWalletOperation).findOneByOrFail({id});
	const tokenAmount = (token: string | null) => getTokenMetadata(token!).amount.toNumber();

	/** Mint ecash into user-1's wallet through a quote already paid */
	const fund = async (mint_id: string, amount: number, fake = orchard()) => {
		const quote_id = `fund-${fake.quotes.size + 1}`;
		fake.quotes.set(quote_id, {state: 'PAID', amount, expiry: null});
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
	/** user-1's Orchard mint, funded */
	const funded = async (amount = 100) => {
		const mint_id = await orchardMint();
		await fund(mint_id, amount);
		return mint_id;
	};
	const send = (mint_id: string, amount: number, memo: string | null = null) =>
		service.sendToken({user_id: 'user-1', mint_id, unit: 'sat', amount, memo});
	const receive = (token: string, add_mint = false) => service.receiveToken('user-2', token, add_mint, false);

	const entities = [
		CashuWalletOperation,
		CashuWalletProof,
		CashuWalletCounter,
		CashuWalletMint,
		CashuWalletMintInfo,
		CashuWalletMintKeyset,
	];

	beforeEach(async () => {
		jest.clearAllMocks();
		mints = new Map([
			[ORCHARD_API, createFakeMint({urls: [ORCHARD_URL]})],
			[CEDAR, createFakeMint({pubkey: '02cedar', input_fee_ppk: 1000})],
		]);
		offline = false;
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletSwapService,
				CashuWalletIssueService,
				CashuWalletJournalService,
				CashuWalletProofService,
				CashuWalletRecoveryService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				CashuWalletMintTransportService,
				{provide: CashuWalletSeedService, useValue: {getSeed: jest.fn(async (user_id: string) => seeds[user_id])}},
				{provide: ConfigService, useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? ORCHARD_API : undefined))}},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuMintRpcService, useValue: {updateNut04Quote: jest.fn()}},
				{provide: UserService, useValue: {getUserById: jest.fn()}},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		service = module.get(CashuWalletSwapService);
		issue = module.get(CashuWalletIssueService);
		recovery = module.get(CashuWalletRecoveryService);
		mint_service = module.get(CashuWalletMintService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	describe('send', () => {
		it('sends a token carrying the public URL, holding its proofs out of the balance until claimed', async () => {
			const mint_id = await funded();
			const sent = await send(mint_id, 30, 'Lunch');
			expect(sent).toMatchObject({
				type: WalletOperationType.SEND,
				state: WalletOperationState.PENDING,
				amount: 30,
				fee: 0,
				error: null,
			});
			expect(getTokenMetadata(sent.token!)).toMatchObject({mint: ORCHARD_URL, unit: 'sat', memo: 'Lunch'});
			expect(tokenAmount(sent.token)).toBe(30);
			expect(await balance()).toBe(70);
			expect(await held()).toBe(30);
		});

		it('refuses to send from the Orchard mint while it publishes no URL', async () => {
			orchard().info.urls = [];
			const mint_id = await funded();
			await expect(send(mint_id, 30)).rejects.toEqual(walletError('Orchard mint has no public URL; add one to its info'));
			expect(await balance()).toBe(100);
		});

		it('reports a shortfall without journaling anything', async () => {
			const mint_id = await funded(20);
			await expect(send(mint_id, 50)).rejects.toThrow(/Not enough funds/);
			expect(await data_source.getRepository(CashuWalletOperation).countBy({type: WalletOperationType.SEND})).toBe(0);
			expect(await balance()).toBe(20);
		});

		it('never lets concurrent sends pick the same proofs', async () => {
			const mint_id = await funded();
			await fund(mint_id, 100);
			const sent = await Promise.all([send(mint_id, 40), send(mint_id, 40)]);
			expect(sent.map((operation) => operation.state)).toEqual([WalletOperationState.PENDING, WalletOperationState.PENDING]);
			expect(await balance()).toBe(120);
			expect(await held()).toBe(80);
		});

		it('gives the inputs back when the mint refuses the swap outright, quoting its reason', async () => {
			const mint_id = await funded();
			orchard().failures.push({code: 11014, detail: 'Max inputs exceeded'});
			expect(await send(mint_id, 30)).toMatchObject({
				state: WalletOperationState.FAILED,
				token: null,
				error: 'Mint error 11014: Max inputs exceeded',
			});
			expect(await balance()).toBe(100);
		});

		it('keeps a send executing while the mint is unreachable, finishing it on recovery', async () => {
			const mint_id = await funded();
			offline = true;
			const sent = await send(mint_id, 30);
			expect(sent).toMatchObject({state: WalletOperationState.EXECUTING, error: expect.stringContaining('socket hang up')});

			offline = false;
			await recovery.reconcileOperations();
			const settled = await reload(sent.id);
			expect(settled).toMatchObject({state: WalletOperationState.PENDING, error: null});
			expect(tokenAmount(settled.token)).toBe(30);
		});

		it('restores the token and change of a swap whose response was lost', async () => {
			const mint_id = await funded();
			orchard().lost.add('/v1/swap');
			const sent = await send(mint_id, 30);
			expect(sent).toMatchObject({state: WalletOperationState.EXECUTING, token: null, error: expect.stringContaining('HTTP 504')});

			await recovery.reconcileOperations();
			const settled = await reload(sent.id);
			expect(settled).toMatchObject({state: WalletOperationState.PENDING, error: null});
			expect(tokenAmount(settled.token)).toBe(30);
			expect(await balance()).toBe(70);
			expect(await held()).toBe(30);
		});

		it("adds the receiver's fee to a token on a fee-bearing keyset, so the receiver nets at least the amount", async () => {
			const mint_id = (await mint_service.addMint('user-1', CEDAR)).id;
			await fund(mint_id, 100, cedar());
			const sent = await send(mint_id, 10);
			expect(sent.fee).toBeGreaterThan(0);
			expect(await balance()).toBe(100 - 10 - sent.fee!);

			const received = await receive(sent.token!, true);
			expect(received.state).toBe(WalletOperationState.FINALIZED);
			expect(received.amount).toBeGreaterThanOrEqual(10);
			expect(received.amount + received.fee!).toBe(tokenAmount(sent.token));
			expect(await balance('user-2')).toBe(received.amount);
		});
	});

	describe('claim and reclaim', () => {
		it('sees a token claimed on a check and in the background pass', async () => {
			const mint_id = await funded();
			const first = await send(mint_id, 30);
			const second = await send(mint_id, 20);
			expect(await service.checkToken('user-1', first.id)).toMatchObject({state: WalletOperationState.PENDING});

			await receive(first.token!);
			await receive(second.token!);
			expect(await service.checkToken('user-1', first.id)).toMatchObject({state: WalletOperationState.FINALIZED});
			await recovery.reconcileOperations();
			expect(await reload(second.id)).toMatchObject({state: WalletOperationState.FINALIZED});
			expect(await held()).toBe(0);
		});

		it('checks every unclaimed token at a mint in one request, leaving them waiting while it is offline', async () => {
			const mint_id = await funded();
			const sent = [await send(mint_id, 10), await send(mint_id, 20), await send(mint_id, 30)];
			await receive(sent[1].token!);
			const states = async () => (await Promise.all(sent.map((operation) => reload(operation.id)))).map(({state}) => state);
			const checkstates = () => fetch_service.fetchWithProxy.mock.calls.filter(([url]) => url.endsWith('/v1/checkstate')).length;

			offline = true;
			await recovery.reconcileOperations();
			expect(await states()).toEqual([WalletOperationState.PENDING, WalletOperationState.PENDING, WalletOperationState.PENDING]);

			offline = false;
			fetch_service.fetchWithProxy.mockClear();
			await recovery.reconcileOperations();
			expect(checkstates()).toBe(1);
			expect(await states()).toEqual([WalletOperationState.PENDING, WalletOperationState.FINALIZED, WalletOperationState.PENDING]);
		});

		it('takes an unclaimed token back, after which it can no longer be received', async () => {
			const mint_id = await funded();
			const sent = await send(mint_id, 30);
			expect(await service.reclaimToken('user-1', sent.id)).toMatchObject({
				state: WalletOperationState.RECLAIMED,
				fee: 0,
				error: null,
			});
			expect(await balance()).toBe(100);
			expect(await held()).toBe(0);
			await expect(service.reclaimToken('user-1', sent.id)).rejects.toEqual(walletError('Only an unclaimed token can be reclaimed'));

			expect(await receive(sent.token!)).toMatchObject({
				state: WalletOperationState.FAILED,
				error: 'Mint error 11001: Token already spent',
			});
			expect(await balance('user-2')).toBe(0);
		});

		it("reclaims only the token while another send is still spending the first send's change", async () => {
			const mint_id = await funded();
			const first = await send(mint_id, 30);
			offline = true;
			const second = await send(mint_id, 70);
			expect(second.state).toBe(WalletOperationState.EXECUTING);

			offline = false;
			expect(await service.reclaimToken('user-1', first.id)).toMatchObject({state: WalletOperationState.RECLAIMED});
			await recovery.reconcileOperations();
			const settled = await reload(second.id);
			expect(settled.state).toBe(WalletOperationState.PENDING);
			expect(tokenAmount(settled.token)).toBe(70);
			expect(await balance()).toBe(30);
			expect(await held()).toBe(70);
		});

		it('finishes the send instead when the token was claimed before the reclaim', async () => {
			const mint_id = await funded();
			const sent = await send(mint_id, 30);
			await receive(sent.token!);
			expect(await service.reclaimToken('user-1', sent.id)).toMatchObject({state: WalletOperationState.FINALIZED});
			expect(await balance()).toBe(70);
		});
	});

	describe('receive', () => {
		it('receives a token into another wallet', async () => {
			const mint_id = await funded();
			const sent = await send(mint_id, 30, 'Lunch');
			expect(await receive(sent.token!)).toMatchObject({
				type: WalletOperationType.RECEIVE,
				state: WalletOperationState.FINALIZED,
				mint_id: await orchardMint('user-2'),
				amount: 30,
				fee: 0,
				memo: 'Lunch',
			});
			expect(await balance('user-2')).toBe(30);
		});

		it('previews a token with its fee and claimed state once its mint is in the wallet', async () => {
			const mint_id = await funded();
			const sent = await send(mint_id, 30, 'Lunch');
			expect(await service.previewToken('user-2', sent.token!, false)).toMatchObject({
				amount: 30,
				unit: 'sat',
				memo: 'Lunch',
				fee: 0,
				claimed: false,
				mint: {url: ORCHARD_URL, match: WalletMintMatch.URL},
			});
			await receive(sent.token!);
			expect(await service.previewToken('user-2', sent.token!, false)).toMatchObject({claimed: true});
		});

		it('adds the mint of a token from outside the wallet only when asked to', async () => {
			const mint_id = (await mint_service.addMint('user-1', CEDAR)).id;
			await fund(mint_id, 100, cedar());
			const sent = await send(mint_id, 10);
			expect(await service.previewToken('user-2', sent.token!, false)).toMatchObject({
				fee: null,
				claimed: null,
				mint: {url: CEDAR, match: null, mint_id: null},
			});
			await expect(receive(sent.token!)).rejects.toEqual(walletError(`Add ${CEDAR} to receive this token`));
			expect(await receive(sent.token!, true)).toMatchObject({state: WalletOperationState.FINALIZED, mint_id: expect.any(String)});
			expect(await data_source.getRepository(CashuWalletMint).findOneBy({user_id: 'user-2', pubkey: '02cedar'})).toMatchObject({
				urls: [CEDAR],
			});
		});

		it('refuses something that is not a token', async () => {
			await expect(receive('cashuBnope')).rejects.toMatchObject({details: expect.stringMatching(/^Not an ecash token/)});
		});

		it('reloads the keysets once for a token whose short keyset id the wallet does not know', async () => {
			mints.set(CEDAR, createFakeMint({pubkey: '02cedar', version_byte: 1}));
			const cedar_id = (await mint_service.addMint('user-2', CEDAR)).id;
			await mint_service.getWallet(cedar_id, 'sat');
			cedar().rotate();

			const outsider = new Wallet(new Mint(CEDAR, {customRequest: fakeMintRequest(cedar())}), {unit: 'sat'});
			await outsider.loadMint();
			const quote = await outsider.createMintQuoteBolt11(20);
			cedar().quotes.get(quote.quote)!.state = 'PAID';
			const proofs = await outsider.mintProofsBolt11(20, quote.quote);
			const token = getEncodedToken({mint: CEDAR, proofs, unit: 'sat'});

			expect(await receive(token)).toMatchObject({state: WalletOperationState.FINALIZED, amount: 20});
			expect(await balance('user-2')).toBe(20);
		});
	});
});
