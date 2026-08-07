/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Native Dependencies */
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {CdkService} from '#server/modules/cashu/cdk/cdk.service';
import {NutshellService} from '#server/modules/cashu/nutshell/nutshell.service';
/* Local Dependencies */
import {CashuMintRpcService} from './cashumintrpc.service.js';
import {OrchardErrorCode} from '#server/modules/error/error.types';

describe('CashuMintRpcService', () => {
	let cashuMintRpcService: CashuMintRpcService;
	let configService: jest.Mocked<ConfigService>;
	let cdkService: jest.Mocked<CdkService>;
	let nutshellService: jest.Mocked<NutshellService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuMintRpcService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CdkService, useValue: {initializeGrpcClient: jest.fn()}},
				{provide: NutshellService, useValue: {initializeGrpcClient: jest.fn()}},
			],
		}).compile();

		cashuMintRpcService = module.get<CashuMintRpcService>(CashuMintRpcService);
		configService = module.get(ConfigService);
		cdkService = module.get(CdkService);
		nutshellService = module.get(NutshellService);
	});

	it('should be defined', () => {
		expect(cashuMintRpcService).toBeDefined();
	});

	it('throws connection error when no client initialized', async () => {
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(OrchardErrorCode.MintRpcConnectionError);
	});

	it('delegates to CDK and maps getMintInfo', async () => {
		const client = {GetInfo: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {long_description: 'L'}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		const out = await cashuMintRpcService.getMintInfo();
		expect(out.description_long).toBe('L');
	});

	it('initializes nutshell client when type is nutshell', async () => {
		const client = {GetInfo: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {long_description: 'X'}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		const out = await cashuMintRpcService.getMintInfo();
		expect(nutshellService.initializeGrpcClient).toHaveBeenCalledTimes(1);
		expect(out.description_long).toBe('X');
	});

	it('unknown type yields connection error', async () => {
		configService.get.mockReturnValue('unknown');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(OrchardErrorCode.MintRpcConnectionError);
	});

	it('maps UNAVAILABLE and INTERNAL errors correctly', async () => {
		const client = {
			GetInfo: jest.fn((req: any, _metadata: any, cb: any) =>
				cb({code: 14, message: '14 UNAVAILABLE', details: 'Service unavailable'}, null),
			),
		};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toEqual({
			code: OrchardErrorCode.MintRpcConnectionError,
			details: 'Service unavailable',
		});

		client.GetInfo.mockImplementationOnce((req: any, _metadata: any, cb: any) =>
			cb({code: 13, message: '13 INTERNAL', details: 'Internal error'}, null),
		);
		await expect(cashuMintRpcService.getMintInfo()).rejects.toEqual({
			code: OrchardErrorCode.MintRpcInternalError,
			details: 'Internal error',
		});
	});

	it('maps UNIMPLEMENTED to MintSupportError and logs', async () => {
		const debug_spy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
		const client = {
			GetInfo: jest.fn((req: any, _metadata: any, cb: any) =>
				cb({code: 12, message: '12 UNIMPLEMENTED', details: 'Not implemented'}, null),
			),
		};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toEqual({
			code: OrchardErrorCode.MintSupportError,
			details: 'Not implemented',
		});
		expect(debug_spy).toHaveBeenCalled();
		debug_spy.mockRestore();
	});

	it('passes through unknown errors', async () => {
		const err = new Error('boom');
		const client = {GetInfo: jest.fn((req: any, _metadata: any, cb: any) => cb(err, null))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(err);
	});

	it('unsupported method maps to support error', async () => {
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue({} as any);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(OrchardErrorCode.MintSupportError);
	});

	it('getQuoteTtl forwards empty request', async () => {
		const client = {GetQuoteTtl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {mint_ttl: 1, melt_ttl: 2}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.getQuoteTtl();
		expect(client.GetQuoteTtl).toHaveBeenCalledWith({}, expect.any(Object), expect.any(Function));
	});

	it('updateName sends name including null', async () => {
		const client: any = {UpdateName: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateName({name: 'mint'});
		expect(client.UpdateName).toHaveBeenCalledWith({name: 'mint'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateName({name: null});
		expect(client.UpdateName).toHaveBeenCalledWith({name: null}, expect.any(Object), expect.any(Function));
	});

	it('updateMotd sends motd', async () => {
		const client: any = {UpdateMotd: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateMotd({motd: 'hi'});
		expect(client.UpdateMotd).toHaveBeenCalledWith({motd: 'hi'}, expect.any(Object), expect.any(Function));
	});

	it('updateShortDescription sends description', async () => {
		const client: any = {UpdateShortDescription: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateShortDescription({description: 'd'});
		expect(client.UpdateShortDescription).toHaveBeenCalledWith({description: 'd'}, expect.any(Object), expect.any(Function));
	});

	it('updateLongDescription sends description', async () => {
		const client: any = {UpdateLongDescription: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateLongDescription({description: 'dd'});
		expect(client.UpdateLongDescription).toHaveBeenCalledWith({description: 'dd'}, expect.any(Object), expect.any(Function));
	});

	it('updateIconUrl sends icon_url', async () => {
		const client: any = {UpdateIconUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateIconUrl({icon_url: 'http://x'});
		expect(client.UpdateIconUrl).toHaveBeenCalledWith({icon_url: 'http://x'}, expect.any(Object), expect.any(Function));
	});

	it('addUrl and removeUrl send url', async () => {
		const client: any = {
			AddUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
			RemoveUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
		};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.addUrl({url: 'u'});
		expect(client.AddUrl).toHaveBeenCalledWith({url: 'u'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.removeUrl({url: 'u'});
		expect(client.RemoveUrl).toHaveBeenCalledWith({url: 'u'}, expect.any(Object), expect.any(Function));
	});

	it('addContact and removeContact send method and info', async () => {
		const client: any = {
			AddContact: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
			RemoveContact: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
		};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.addContact({method: 'nostr', info: 'npub'});
		expect(client.AddContact).toHaveBeenCalledWith({method: 'nostr', info: 'npub'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.removeContact({method: 'nostr', info: 'npub'});
		expect(client.RemoveContact).toHaveBeenCalledWith({method: 'nostr', info: 'npub'}, expect.any(Object), expect.any(Function));
	});

	it('updateNut04 builds request with optional fields correctly', async () => {
		const client: any = {UpdateNut04: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateNut04({unit: 'sat', method: 'bolt11'});
		expect(client.UpdateNut04).toHaveBeenCalledWith({unit: 'sat', method: 'bolt11'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateNut04({unit: 'sat', method: 'bolt11', disabled: true, min_amount: 1, max_amount: 10});
		expect(client.UpdateNut04).toHaveBeenCalledWith(
			{unit: 'sat', method: 'bolt11', disabled: true, min_amount: 1, max_amount: 10},
			expect.any(Object),
			expect.any(Function),
		);
		await cashuMintRpcService.updateNut04({unit: 'sat', method: 'bolt11', description: true});
		expect(client.UpdateNut04).toHaveBeenCalledWith(
			{unit: 'sat', method: 'bolt11', options: {description: true}},
			expect.any(Object),
			expect.any(Function),
		);
	});

	it('updateNut05 builds request with optional fields correctly', async () => {
		const client: any = {UpdateNut05: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateNut05({unit: 'sat', method: 'bolt11'});
		expect(client.UpdateNut05).toHaveBeenCalledWith({unit: 'sat', method: 'bolt11'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateNut05({unit: 'sat', method: 'bolt11', disabled: true, min_amount: 1, max_amount: 10});
		expect(client.UpdateNut05).toHaveBeenCalledWith(
			{unit: 'sat', method: 'bolt11', disabled: true, min_amount: 1, max_amount: 10},
			expect.any(Object),
			expect.any(Function),
		);
		await cashuMintRpcService.updateNut05({unit: 'sat', method: 'bolt11', amountless: true});
		expect(client.UpdateNut05).toHaveBeenCalledWith(
			{unit: 'sat', method: 'bolt11', options: {amountless: true}},
			expect.any(Object),
			expect.any(Function),
		);
	});

	it('updateQuoteTtl sends only provided fields', async () => {
		const client: any = {UpdateQuoteTtl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateQuoteTtl({});
		expect(client.UpdateQuoteTtl).toHaveBeenCalledWith({}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateQuoteTtl({mint_ttl: 100});
		expect(client.UpdateQuoteTtl).toHaveBeenCalledWith({mint_ttl: 100}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateQuoteTtl({melt_ttl: 200});
		expect(client.UpdateQuoteTtl).toHaveBeenCalledWith({melt_ttl: 200}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateQuoteTtl({mint_ttl: 100, melt_ttl: 200});
		expect(client.UpdateQuoteTtl).toHaveBeenCalledWith({mint_ttl: 100, melt_ttl: 200}, expect.any(Object), expect.any(Function));
	});

	it('updateNut04Quote sends quote_id and state', async () => {
		const client: any = {UpdateNut04Quote: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {quote_id: 'q', state: 's'}))};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateNut04Quote({quote_id: 'q', state: 's'});
		expect(client.UpdateNut04Quote).toHaveBeenCalledWith({quote_id: 'q', state: 's'}, expect.any(Object), expect.any(Function));
	});

	it('rotateNextKeyset sends unit and optional fields when provided', async () => {
		const client: any = {
			RotateNextKeyset: jest.fn((req: any, _metadata: any, cb: any) =>
				cb(null, {id: '1', unit: 'sat', amounts: [1, 2, 4], input_fee_ppk: 2}),
			),
		};
		(cdkService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('cdk');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat'});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith({unit: 'sat'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat', amounts: [1, 2, 4, 8]});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith(
			{unit: 'sat', amounts: [1, 2, 4, 8]},
			expect.any(Object),
			expect.any(Function),
		);
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat', input_fee_ppk: 5});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith({unit: 'sat', input_fee_ppk: 5}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat', amounts: [1, 2, 4, 8], input_fee_ppk: 5});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith(
			{unit: 'sat', amounts: [1, 2, 4, 8], input_fee_ppk: 5},
			expect.any(Object),
			expect.any(Function),
		);
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat', final_expiry: 1893456000});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith(
			{unit: 'sat', final_expiry: 1893456000},
			expect.any(Object),
			expect.any(Function),
		);
		// A null expiry must be omitted, not forwarded — proto3 encodes null as 0 (epoch),
		// which nutshell stores verbatim as a bogus "already expired" stamp.
		await cashuMintRpcService.rotateNextKeyset({unit: 'sat', final_expiry: null});
		expect(client.RotateNextKeyset).toHaveBeenCalledWith({unit: 'sat'}, expect.any(Object), expect.any(Function));
	});
});
