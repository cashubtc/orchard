/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
/* Native Dependencies */
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
/* Local Dependencies */
import {LightningService} from './lightning.service.js';
import {OrchardErrorCode} from '#server/modules/error/error.types';

describe('LightningService', () => {
	let lightningService: LightningService;
	let configService: jest.Mocked<ConfigService>;
	let lndService: jest.Mocked<LndService>;
	let clnService: jest.Mocked<ClnService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: BitcoinRpcService, useValue: {getBitcoinBlockchainInfo: jest.fn()}},
				{provide: LndService, useValue: {initializeLightningClient: jest.fn(), mapLndRequest: jest.fn()}},
				{
					provide: ClnService,
					useValue: {
						initializeLightningClient: jest.fn(),
						mapClnInfo: jest.fn(),
						mapClnChannelBalance: jest.fn(),
						mapClnRequest: jest.fn(),
					},
				},
			],
		}).compile();

		lightningService = module.get<LightningService>(LightningService);
		configService = module.get(ConfigService);
		lndService = module.get(LndService);
		clnService = module.get(ClnService);
	});

	it('should be defined', () => {
		expect(lightningService).toBeDefined();
	});

	it('throws connection error when no client initialized', async () => {
		configService.get.mockReturnValueOnce('lnd');
		await lightningService.onModuleInit();
		await expect(lightningService.getLightningInfo()).rejects.toBe(OrchardErrorCode.LightningRpcConnectionError);
	});

	it('delegates to LND when type is lnd', async () => {
		const client = {
			GetInfo: jest.fn((req: any, cb: any) => cb(null, {version: 'v'})),
			DecodePayReq: jest.fn((req: any, cb: any) => cb(null, {valid: true})),
		};
		(lndService.initializeLightningClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningService.onModuleInit();
		await expect(lightningService.getLightningInfo()).resolves.toEqual({version: 'v'});
		(lndService.mapLndRequest as jest.Mock).mockReturnValue({valid: true});
		const decoded = await lightningService.getLightningRequest('bolt11');
		expect(decoded).toEqual({valid: true});
	});

	it('delegates to CLN and maps responses', async () => {
		const client = {
			Getinfo: jest.fn((req: any, cb: any) => cb(null, {id: 'aa'})),
			ListFunds: jest.fn((req: any, cb: any) => cb(null, {channels: []})),
			ListPeerChannels: jest.fn((req: any, cb: any) => cb(null, {channels: []})),
			Decode: jest.fn((req: any, cb: any) => cb(null, {valid: true})),
		};
		(clnService.initializeLightningClient as jest.Mock).mockReturnValue(client);
		(clnService.mapClnInfo as jest.Mock).mockResolvedValue({version: 'v2'});
		(clnService.mapClnChannelBalance as jest.Mock).mockResolvedValue({balance: '0'});
		(clnService.mapClnRequest as jest.Mock).mockReturnValue({valid: true});
		configService.get.mockReturnValue('cln');
		await lightningService.onModuleInit();
		await expect(lightningService.getLightningInfo()).resolves.toEqual({version: 'v2'});
		await expect(lightningService.getLightningChannelBalance()).resolves.toEqual({balance: '0'});
		await expect(lightningService.getLightningRequest('str')).resolves.toEqual({valid: true});
	});

	it('maps UNAVAILABLE error to connection code', async () => {
		const client = {GetInfo: jest.fn((req: any, cb: any) => cb(new Error('14 UNAVAILABLE'), null))};
		(lndService.initializeLightningClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningService.onModuleInit();
		await expect(lightningService.getLightningInfo()).rejects.toBe(OrchardErrorCode.LightningRpcConnectionError);
	});

	it('unsupported method rejects with support error', async () => {
		const client = {} as any;
		(lndService.initializeLightningClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('lnd');
		await lightningService.onModuleInit();
		await expect(lightningService.getLightningChannelBalance()).rejects.toBe(OrchardErrorCode.LightningSupportError);
	});
});
