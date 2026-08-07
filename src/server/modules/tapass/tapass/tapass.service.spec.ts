/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {TapdService} from '@server/modules/tapass/tapd/tapd.service';
/* Local Dependencies */
import {TaprootAssetsService} from './tapass.service.js';
import {OrchardErrorCode} from '@server/modules/error/error.types';

describe('TaprootAssetsService', () => {
	let taprootAssetsService: TaprootAssetsService;
	let configService: jest.Mocked<ConfigService>;
	let tapdService: jest.Mocked<TapdService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TaprootAssetsService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: TapdService, useValue: {initializeTaprootAssetsClient: jest.fn().mockReturnValue({})}},
			],
		}).compile();

		taprootAssetsService = module.get<TaprootAssetsService>(TaprootAssetsService);
		configService = module.get(ConfigService);
		tapdService = module.get(TapdService);
		configService.get.mockReturnValue('tapd');
		await taprootAssetsService.onModuleInit();
	});

	it('should be defined', () => {
		expect(taprootAssetsService).toBeDefined();
	});

	it('throws connection error when no client initialized', async () => {
		// re-create with missing client
		const module2: TestingModule = await Test.createTestingModule({
			providers: [
				TaprootAssetsService,
				{provide: ConfigService, useValue: {get: jest.fn().mockReturnValue('tapd')}},
				{provide: TapdService, useValue: {initializeTaprootAssetsClient: jest.fn().mockReturnValue(null)}},
			],
		}).compile();
		const svc = module2.get<TaprootAssetsService>(TaprootAssetsService);
		await svc.onModuleInit();
		await expect(svc.getTaprootAssetsInfo()).rejects.toBe(OrchardErrorCode.TaprootAssetsRpcConnectionError);
	});

	it('delegates methods to grpc client and returns responses', async () => {
		const client = {
			GetInfo: jest.fn((req: any, cb: any) => cb(null, {version: 'v'})),
			ListAssets: jest.fn((req: any, cb: any) => cb(null, {assets: []})),
			ListUtxos: jest.fn((req: any, cb: any) => cb(null, {utxos: []})),
		};
		tapdService.initializeTaprootAssetsClient.mockReturnValue(client as any);
		await taprootAssetsService.onModuleInit();
		await expect(taprootAssetsService.getTaprootAssetsInfo()).resolves.toEqual({version: 'v'});
		await expect(taprootAssetsService.getListTaprootAssets()).resolves.toEqual({assets: []});
		await expect(taprootAssetsService.getListTaprootAssetsUtxos()).resolves.toEqual({utxos: []});
	});

	it('maps UNAVAILABLE error to connection error code', async () => {
		const client = {
			GetInfo: jest.fn((req: any, cb: any) => cb(new Error('14 UNAVAILABLE: upstream down'), null)),
		};
		tapdService.initializeTaprootAssetsClient.mockReturnValue(client as any);
		await taprootAssetsService.onModuleInit();
		await expect(taprootAssetsService.getTaprootAssetsInfo()).rejects.toBe(OrchardErrorCode.TaprootAssetsRpcConnectionError);
	});

	it('rejects with error for unsupported method', async () => {
		const bad_client = {} as any;
		tapdService.initializeTaprootAssetsClient.mockReturnValue(bad_client);
		await taprootAssetsService.onModuleInit();
		await expect(taprootAssetsService.getTaprootAssetsInfo()).rejects.toBe(OrchardErrorCode.TaprootAssetsSupportError);
	});
});
