/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {LightningWalletKitService} from '#server/modules/lightning/walletkit/lnwalletkit.service';
import {MintReserveSource, MintReserveStatus} from '#server/modules/cashu/cashu.enums';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {SettingService} from '#server/modules/setting/setting.service';
/* Local Dependencies */
import {MintReserveService} from './mintreserve.service.js';
import type {OrchardMintReserveSource} from './mintreserve.model.js';

describe('MintReserveService', () => {
	let mintReserveService: MintReserveService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let mintRpcService: jest.Mocked<CashuMintRpcService>;
	let lightningService: jest.Mocked<LightningService>;
	let walletKitService: jest.Mocked<LightningWalletKitService>;
	let settingService: jest.Mocked<SettingService>;

	const channel = (local_balance: string, active: boolean, asset: object | null = null) => ({local_balance, active, asset});
	const addresses = (...balances: number[]) => ({account_with_addresses: [{addresses: balances.map((balance) => ({balance}))}]});
	const source = (sources: OrchardMintReserveSource[], name: MintReserveSource) => sources.find((item) => item.source === name);
	const store = (value: string) => settingService.getSetting.mockResolvedValue({value} as any);

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintReserveService,
				ErrorService,
				{provide: CashuMintDatabaseService, useValue: {getBalances: jest.fn()}},
				{provide: CashuMintRpcService, useValue: {isConfigured: jest.fn(), getMintWalletBalance: jest.fn()}},
				{provide: LightningService, useValue: {isConfigured: jest.fn(), getChannels: jest.fn()}},
				{provide: LightningWalletKitService, useValue: {isConfigured: jest.fn(), getLightningAddresses: jest.fn()}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn) => fn({}))}},
				{provide: SettingService, useValue: {getSetting: jest.fn()}},
			],
		}).compile();

		mintReserveService = module.get(MintReserveService);
		mintDbService = module.get(CashuMintDatabaseService);
		mintRpcService = module.get(CashuMintRpcService);
		lightningService = module.get(LightningService);
		walletKitService = module.get(LightningWalletKitService);
		settingService = module.get(SettingService);

		mintDbService.getBalances.mockResolvedValue([]);
		lightningService.isConfigured.mockReturnValue(true);
		walletKitService.isConfigured.mockReturnValue(true);
		mintRpcService.isConfigured.mockReturnValue(true);
		lightningService.getChannels.mockResolvedValue([] as any);
		walletKitService.getLightningAddresses.mockResolvedValue(addresses() as any);
		mintRpcService.getMintWalletBalance.mockResolvedValue({trusted_spendable_sat: '0'} as any);
		settingService.getSetting.mockResolvedValue(null);
	});

	it('should be defined', () => {
		expect(mintReserveService).toBeDefined();
	});

	it('sums liabilities per bitcoin unit, including postgres string balances, and drops other units', async () => {
		mintDbService.getBalances.mockResolvedValue([
			{keyset: 'a', balance: '1000', unit: 'sat'},
			{keyset: 'b', balance: 500, unit: 'SAT'},
			{keyset: 'c', balance: 2000, unit: 'msat'},
			{keyset: 'd', balance: 250, unit: 'usd'},
			{keyset: 'e', balance: 9, unit: null},
		] as any);
		const reserves = await mintReserveService.getMintReserves('TAG');
		expect(reserves.liabilities.map(({unit, amount}) => ({unit, amount}))).toEqual([
			{unit: 'sat', amount: 1500},
			{unit: 'msat', amount: 2000},
		]);
	});

	it('splits channel outbound into active and inactive, leaving out asset channels', async () => {
		lightningService.getChannels.mockResolvedValue([
			channel('600', true),
			channel('400', false),
			channel('900', true, {asset_id: 'usd'}),
		] as any);
		const {sources} = await mintReserveService.getMintReserves('TAG');
		expect(source(sources, MintReserveSource.LIGHTNING_ACTIVE)).toEqual(
			expect.objectContaining({status: MintReserveStatus.AVAILABLE, amount: 600}),
		);
		expect(source(sources, MintReserveSource.LIGHTNING_INACTIVE)?.amount).toBe(400);
	});

	it('reads the lightning hot wallet and the mint on-chain wallet', async () => {
		walletKitService.getLightningAddresses.mockResolvedValue(addresses(1000, 2500) as any);
		mintRpcService.getMintWalletBalance.mockResolvedValue({trusted_spendable_sat: '21000'} as any);
		const {sources} = await mintReserveService.getMintReserves('TAG');
		expect(source(sources, MintReserveSource.LIGHTNING_WALLET)?.amount).toBe(3500);
		expect(source(sources, MintReserveSource.MINT_WALLET)?.amount).toBe(21000);
	});

	it('marks sources unconfigured without calling their backends', async () => {
		lightningService.isConfigured.mockReturnValue(false);
		walletKitService.isConfigured.mockReturnValue(false);
		mintRpcService.isConfigured.mockReturnValue(false);
		const {sources} = await mintReserveService.getMintReserves('TAG');
		expect(sources.map((item) => item.status)).toEqual(Array(4).fill(MintReserveStatus.UNCONFIGURED));
		expect(sources.every((item) => item.amount === null)).toBe(true);
		expect(lightningService.getChannels).not.toHaveBeenCalled();
		expect(walletKitService.getLightningAddresses).not.toHaveBeenCalled();
		expect(mintRpcService.getMintWalletBalance).not.toHaveBeenCalled();
	});

	it('marks the mint wallet unsupported on mints that have none', async () => {
		mintRpcService.getMintWalletBalance.mockRejectedValue({
			code: OrchardErrorCode.MintSupportError,
			details: 'On-chain wallets are only supported in CDK mints',
		});
		const {sources} = await mintReserveService.getMintReserves('TAG');
		expect(source(sources, MintReserveSource.MINT_WALLET)).toEqual(
			expect.objectContaining({status: MintReserveStatus.UNSUPPORTED, amount: null, error_code: OrchardErrorCode.MintSupportError}),
		);
	});

	it("keeps the mint's own message when its wallet can't be read, and leaves the other sources alone", async () => {
		const details = 'No on-chain wallet information provider is configured';
		mintRpcService.getMintWalletBalance.mockRejectedValue({code: status.FAILED_PRECONDITION, details});
		lightningService.getChannels.mockResolvedValue([channel('600', true)] as any);
		const {sources} = await mintReserveService.getMintReserves('TAG');
		expect(source(sources, MintReserveSource.MINT_WALLET)).toEqual(
			expect.objectContaining({
				status: MintReserveStatus.UNAVAILABLE,
				error_code: OrchardErrorCode.MintRpcActionError,
				error_details: details,
			}),
		);
		expect(source(sources, MintReserveSource.LIGHTNING_ACTIVE)?.status).toBe(MintReserveStatus.AVAILABLE);
	});

	it('fails the whole query when liabilities cannot be read', async () => {
		mintDbService.getBalances.mockRejectedValue(new Error('boom'));
		await expect(mintReserveService.getMintReserves('TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});

	it('counts every channel as reserves until the operator chooses otherwise', async () => {
		lightningService.getChannels.mockResolvedValue([channel('600', true), channel('400', false)] as any);
		mintRpcService.getMintWalletBalance.mockResolvedValue({trusted_spendable_sat: '21000'} as any);
		const reserves = await mintReserveService.getMintReserves('TAG');
		expect(reserves.reserves).toBe(1000);
		expect(reserves.partial).toBe(false);
		expect(reserves.sources.filter((item) => item.selected).map((item) => item.source)).toEqual([
			MintReserveSource.LIGHTNING_ACTIVE,
			MintReserveSource.LIGHTNING_INACTIVE,
		]);
	});

	it('sums only the sources the operator selected', async () => {
		store('["LIGHTNING_ACTIVE","MINT_WALLET"]');
		lightningService.getChannels.mockResolvedValue([channel('600', true), channel('400', false)] as any);
		mintRpcService.getMintWalletBalance.mockResolvedValue({trusted_spendable_sat: '21000'} as any);
		expect((await mintReserveService.getMintReserves('TAG')).reserves).toBe(21600);
	});

	it('flags the reserves partial when a selected source fails, and has none when nothing selected can be read', async () => {
		store('["MINT_WALLET"]');
		mintRpcService.getMintWalletBalance.mockRejectedValue({code: status.FAILED_PRECONDITION, details: 'No on-chain wallet'});
		const reserves = await mintReserveService.getMintReserves('TAG');
		expect(reserves.reserves).toBeNull();
		expect(reserves.partial).toBe(true);
	});

	it('counts every channel when the stored selection is invalid', async () => {
		store('{"sources":"MINT_WALLET"}');
		lightningService.getChannels.mockResolvedValue([channel('600', true), channel('400', false)] as any);
		expect((await mintReserveService.getMintReserves('TAG')).reserves).toBe(1000);
	});
});
