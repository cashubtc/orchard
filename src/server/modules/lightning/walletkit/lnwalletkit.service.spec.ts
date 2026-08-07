/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Native Dependencies */
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
/* Local Dependencies */
import {LightningWalletKitService} from './lnwalletkit.service.js';
import {OrchardErrorCode} from '#server/modules/error/error.types';

describe('LightningWalletKitService', () => {
	let lightningWalletKitService: LightningWalletKitService;
	let configService: jest.Mocked<ConfigService>;
	let lndService: jest.Mocked<LndService>;
	let clnService: jest.Mocked<ClnService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningWalletKitService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: LndService, useValue: {initializeWalletKitClient: jest.fn()}},
				{provide: ClnService, useValue: {initializeWalletKitClient: jest.fn(), mapClnAddresses: jest.fn()}},
			],
		}).compile();

		lightningWalletKitService = module.get<LightningWalletKitService>(LightningWalletKitService);
		configService = module.get(ConfigService);
		lndService = module.get(LndService);
		clnService = module.get(ClnService);
	});

	it('should be defined', () => {
		expect(lightningWalletKitService).toBeDefined();
	});

	it('throws connection error when no client', async () => {
		configService.get.mockReturnValue('lnd');
		await lightningWalletKitService.onModuleInit();
		await expect(lightningWalletKitService.getLightningAddresses()).rejects.toBe(OrchardErrorCode.LightningRpcConnectionError);
	});

	it('delegates to LND and returns addresses', async () => {
		const client = {ListAddresses: jest.fn((req: any, cb: any) => cb(null, {account_with_addresses: []}))};
		(lndService.initializeWalletKitClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningWalletKitService.onModuleInit();
		await expect(lightningWalletKitService.getLightningAddresses()).resolves.toEqual({account_with_addresses: []});
	});

	it('delegates to CLN and maps addresses', async () => {
		const client = {
			ListAddresses: jest.fn((req: any, cb: any) => cb(null, {addresses: []})),
			ListFunds: jest.fn((req: any, cb: any) => cb(null, {outputs: []})),
		};
		(clnService.initializeWalletKitClient as jest.Mock).mockReturnValue(client);
		(clnService.mapClnAddresses as jest.Mock).mockReturnValue({account_with_addresses: []});
		configService.get.mockReturnValue('cln');
		await lightningWalletKitService.onModuleInit();
		await expect(lightningWalletKitService.getLightningAddresses()).resolves.toEqual({account_with_addresses: []});
	});

	it('maps UNAVAILABLE error to connection code', async () => {
		const client = {ListAddresses: jest.fn((req: any, cb: any) => cb(new Error('14 UNAVAILABLE'), null))};
		(lndService.initializeWalletKitClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningWalletKitService.onModuleInit();
		await expect(lightningWalletKitService.getLightningAddresses()).rejects.toBe(OrchardErrorCode.LightningRpcConnectionError);
	});

	it('unsupported method rejects with support error', async () => {
		const client = {} as any;
		(lndService.initializeWalletKitClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningWalletKitService.onModuleInit();
		await expect(lightningWalletKitService.getLightningAddresses()).rejects.toBe(OrchardErrorCode.LightningSupportError);
	});
});
