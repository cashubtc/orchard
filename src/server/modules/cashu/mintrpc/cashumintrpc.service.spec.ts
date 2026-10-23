/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {Client, credentials, Metadata, status, type ServiceError} from '@grpc/grpc-js';
/* Native Dependencies */
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {FederationService} from '#server/modules/federation/federation.service';
import {NutshellService} from '#server/modules/cashu/nutshell/nutshell.service';
/* Local Dependencies */
import {CashuMintRpcService} from './cashumintrpc.service.js';
import {OrchardErrorCode} from '#server/modules/error/error.types';

describe('CashuMintRpcService', () => {
	let cashuMintRpcService: CashuMintRpcService;
	let configService: jest.Mocked<ConfigService>;

	let nutshellService: jest.Mocked<NutshellService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuMintRpcService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CdkRpcService, useValue: {request: jest.fn()}},
				{provide: FederationService, useValue: {assertStandaloneOperation: jest.fn()}},
				{provide: NutshellService, useValue: {initializeGrpcClient: jest.fn()}},
			],
		}).compile();

		cashuMintRpcService = module.get<CashuMintRpcService>(CashuMintRpcService);
		configService = module.get(ConfigService);

		nutshellService = module.get(NutshellService);
	});

	it('should be defined', () => {
		expect(cashuMintRpcService).toBeDefined();
	});

	it('throws connection error when no client initialized', async () => {
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(OrchardErrorCode.MintRpcConnectionError);
	});

	it('delegates to Nutshell and maps getMintInfo', async () => {
		const client = {GetInfo: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {long_description: 'L'}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(err);
	});

	it('unsupported method maps to support error', async () => {
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue({} as any);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getMintInfo()).rejects.toBe(OrchardErrorCode.MintSupportError);
	});

	/** Initialize a provider that returns a real-shaped gRPC error for each test action. */
	function mockGrpcFailure(provider: 'nutshell', code: status, details: string): ServiceError {
		const rpc_error: ServiceError = Object.assign(new Error(details), {code, details, metadata: new Metadata()});
		const fail_request = (_request: unknown, _metadata: Metadata, callback: (error: ServiceError, response: null) => void): void => {
			callback(rpc_error, null);
		};
		const client = Object.assign(new Client('localhost:0', credentials.createInsecure()), {
			UpdateName: jest.fn(fail_request),
			UpdateNut04Quote: jest.fn(fail_request),
		});
		client.close();
		nutshellService.initializeGrpcClient.mockReturnValue(client);
		configService.get.mockReturnValue(provider);
		cashuMintRpcService.onModuleInit();
		return rpc_error;
	}

	it.each([
		{provider: 'nutshell' as const, code: status.PERMISSION_DENIED, details: 'Mint quote state override is disabled'},
		{
			provider: 'nutshell' as const,
			code: status.FAILED_PRECONDITION,
			details: 'A configuration apply is pending; restart cdk-mintd before making management RPC changes',
		},
		{provider: 'nutshell' as const, code: status.PERMISSION_DENIED, details: 'Caller is not authorized'},
		{
			provider: 'nutshell' as const,
			code: status.FAILED_PRECONDITION,
			details: 'No on-chain wallet information provider is configured',
		},
	])('forwards the $provider gRPC failure with its diagnostic intact: $details', async ({provider, code, details}) => {
		const rpc_error = mockGrpcFailure(provider, code, details);
		await expect(cashuMintRpcService.updateNut04Quote({quote_id: 'q', state: 'PAID'})).rejects.toBe(rpc_error);
		expect(rpc_error.details).toBe(details);
	});

	it('Nutshell does not expose quote TTL', async () => {
		configService.get.mockReturnValue('nutshell');
		cashuMintRpcService.onModuleInit();
		await expect(cashuMintRpcService.getQuoteTtl()).resolves.toEqual({mint_ttl: null, melt_ttl: null});
	});

	it('updateName sends name including null', async () => {
		const client: any = {UpdateName: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateName({name: 'mint'});
		expect(client.UpdateName).toHaveBeenCalledWith({name: 'mint'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.updateName({name: null});
		expect(client.UpdateName).toHaveBeenCalledWith({name: null}, expect.any(Object), expect.any(Function));
	});

	it('updateMotd sends motd', async () => {
		const client: any = {UpdateMotd: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateMotd({motd: 'hi'});
		expect(client.UpdateMotd).toHaveBeenCalledWith({motd: 'hi'}, expect.any(Object), expect.any(Function));
	});

	it('updateShortDescription sends description', async () => {
		const client: any = {UpdateShortDescription: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateShortDescription({description: 'd'});
		expect(client.UpdateShortDescription).toHaveBeenCalledWith({description: 'd'}, expect.any(Object), expect.any(Function));
	});

	it('updateLongDescription sends description', async () => {
		const client: any = {UpdateLongDescription: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateLongDescription({description: 'dd'});
		expect(client.UpdateLongDescription).toHaveBeenCalledWith({description: 'dd'}, expect.any(Object), expect.any(Function));
	});

	it('updateIconUrl sends icon_url', async () => {
		const client: any = {UpdateIconUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.updateIconUrl({icon_url: 'http://x'});
		expect(client.UpdateIconUrl).toHaveBeenCalledWith({icon_url: 'http://x'}, expect.any(Object), expect.any(Function));
	});

	it('addUrl and removeUrl send url', async () => {
		const client: any = {
			AddUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
			RemoveUrl: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {})),
		};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
		await cashuMintRpcService.onModuleInit();
		await cashuMintRpcService.addContact({method: 'nostr', info: 'npub'});
		expect(client.AddContact).toHaveBeenCalledWith({method: 'nostr', info: 'npub'}, expect.any(Object), expect.any(Function));
		await cashuMintRpcService.removeContact({method: 'nostr', info: 'npub'});
		expect(client.RemoveContact).toHaveBeenCalledWith({method: 'nostr', info: 'npub'}, expect.any(Object), expect.any(Function));
	});

	it('updateNut04 builds request with optional fields correctly', async () => {
		const client: any = {UpdateNut04: jest.fn((req: any, _metadata: any, cb: any) => cb(null, {}))};
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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
		(nutshellService.initializeGrpcClient as jest.Mock).mockReturnValue(client);
		configService.get.mockReturnValue('nutshell');
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

describe('CashuMintRpcService split CDK adapter', () => {
	let service: CashuMintRpcService;
	const request = jest.fn();
	const assert_standalone = jest.fn();
	beforeEach(async () => {
		request.mockReset().mockResolvedValue({});
		assert_standalone.mockReset().mockResolvedValue(undefined);
		const module = await Test.createTestingModule({
			providers: [
				CashuMintRpcService,
				{provide: ConfigService, useValue: {get: (): string => 'cdk'}},
				{provide: CdkRpcService, useValue: {request}},
				{provide: FederationService, useValue: {assertStandaloneOperation: assert_standalone}},
				{provide: NutshellService, useValue: {initializeGrpcClient: jest.fn()}},
			],
		}).compile();
		service = module.get(CashuMintRpcService);
		service.onModuleInit();
	});
	it('adapts long description and quote TTL for existing resolvers', async () => {
		request.mockResolvedValueOnce({long_description: 'description'});
		await expect(service.getMintInfo()).resolves.toMatchObject({description_long: 'description'});
		await service.updateLongDescription({description: 'new'});
		expect(request).toHaveBeenLastCalledWith('UpdateLongDescription', {long_description: 'new'});
		request.mockResolvedValueOnce({mint_ttl: '60', melt_ttl: '120'});
		await expect(service.getQuoteTtl()).resolves.toEqual({mint_ttl: 60, melt_ttl: 120});
	});
	it('splits payment limits from global disabling and preserves false and zero', async () => {
		await service.updateNut04({unit: 'sat', method: 'bolt11', disabled: false, min_amount: 0, description: false});
		expect(request).toHaveBeenNthCalledWith(1, 'UpdateMintMethod', {
			unit: 'sat',
			method: 'bolt11',
			min_amount: 0,
			options: {description: false},
		});
		expect(request).toHaveBeenNthCalledWith(2, 'UpdateDisabled', {mint_disabled: false});
		await service.updateNut05({unit: 'sat', method: 'bolt11', disabled: true});
		expect(request).toHaveBeenLastCalledWith('UpdateDisabled', {melt_disabled: true});
		expect(request).toHaveBeenCalledTimes(3);
		await service.updateNut05({unit: 'sat', method: 'bolt11', max_amount: 0, amountless: false});
		expect(request).toHaveBeenLastCalledWith('UpdateMeltMethod', {
			unit: 'sat',
			method: 'bolt11',
			max_amount: 0,
			options: {amountless: false},
		});
	});
	it('does not change global disabling if a payment-method update fails', async () => {
		const error = new Error('unsupported method');
		request.mockRejectedValueOnce(error);
		await expect(service.updateNut04({unit: 'sat', method: 'unknown', min_amount: 1, disabled: true})).rejects.toBe(error);
		expect(request).toHaveBeenCalledTimes(1);
	});
	it('translates quote states in both directions and rejects unknown states', async () => {
		request.mockResolvedValueOnce({quote_id: 'q', state: 'MINT_QUOTE_STATE_PAID'});
		await expect(service.updateNut04Quote({quote_id: 'q', state: 'PAID'})).resolves.toEqual({quote_id: 'q', state: 'PAID'});
		expect(request).toHaveBeenCalledWith('UpdateMintQuoteState', {quote_id: 'q', state: 'MINT_QUOTE_STATE_PAID'});
		await expect(service.updateNut04Quote({quote_id: 'q', state: 'oops'})).rejects.toMatchObject({
			code: OrchardErrorCode.MintRpcInvalidArgumentError,
		});
		expect(request).toHaveBeenCalledTimes(1);
	});
	it('blocks member rotation and quote overrides before sending mutations', async () => {
		const error = new Error('not standalone');
		assert_standalone.mockRejectedValue(error);
		await expect(service.rotateNextKeyset({unit: 'sat'})).rejects.toBe(error);
		await expect(service.updateNut04Quote({quote_id: 'q', state: 'PAID'})).rejects.toBe(error);
		expect(request).not.toHaveBeenCalled();
	});
	it('preserves keyset options, omits null expiry and normalizes numerical output', async () => {
		request.mockResolvedValueOnce({id: 'k', unit: 'sat', amounts: ['1', '2'], input_fee_ppk: '0'});
		await expect(service.rotateNextKeyset({unit: 'sat', keyset_v2: false, final_expiry: null})).resolves.toEqual({
			id: 'k',
			unit: 'sat',
			amounts: [1, 2],
			input_fee_ppk: 0,
		});
		expect(request).toHaveBeenCalledWith('RotateNextKeyset', {unit: 'sat', use_keyset_v2: false});
	});
});
