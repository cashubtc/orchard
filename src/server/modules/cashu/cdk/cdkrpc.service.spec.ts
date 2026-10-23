/* Core Dependencies */
import {Test, type TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import path from 'node:path';
/* Vendor Dependencies */
import {Server, ServerCredentials, Client, status, type UntypedServiceImplementation} from '@grpc/grpc-js';
import {loadSync, type ServiceDefinition} from '@grpc/proto-loader';
/* Application Dependencies */
import {CredentialService} from '#server/modules/credential/credential.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
/* Native Dependencies */
import {CdkRpcError, CdkRpcService} from './cdkrpc.service.js';

describe('CdkRpcService wire contracts', () => {
	let server: Server;
	let module: TestingModule;
	let service: CdkRpcService;
	const config: Record<string, unknown> = {};
	const observed: Array<{method: string; request: unknown; header: unknown[]}> = [];
	beforeEach(async () => {
		observed.length = 0;
		server = new Server();
		const names = ['info', 'keyset', 'payment_method', 'quote', 'wallet', 'federation', 'federation_setup'];
		const definitions = loadSync(
			names.map((name) => path.join(process.cwd(), 'proto/cdk', `${name}.proto`)),
			{
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		);
		for (const [name, definition] of Object.entries(definitions)) {
			if (!name.endsWith('Service')) continue;
			const handlers: UntypedServiceImplementation = {};
			for (const method of Object.keys(definition))
				handlers[method] = (call, callback) => {
					observed.push({method, request: call.request, header: call.metadata.get('x-cdk-protocol-version')});
					if (method === 'UpdateName')
						return callback({code: status.FAILED_PRECONDITION, details: 'Configuration apply pending; restart cdk-mintd'});
					if (method === 'UpdateMotd') return; // Exercise the actual transport deadline.
					const response =
						method === 'GetQuoteTtl'
							? {mint_ttl: '9007199254740993', melt_ttl: '60'}
							: method === 'UpdateMintQuoteState'
								? call.request
								: {initialized: false};
					callback(null, response);
				};
			server.addService(definition as ServiceDefinition, handlers);
		}
		const port = await new Promise<number>((resolve, reject) =>
			server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, port) => (error ? reject(error) : resolve(port))),
		);
		Object.assign(config, {'cashu.rpc_host': '127.0.0.1', 'cashu.rpc_port': port, 'cashu.rpc_mtls': false});
		module = await Test.createTestingModule({
			providers: [
				CdkRpcService,
				{provide: ConfigService, useValue: {get: (key: string): unknown => config[key]}},
				{provide: CredentialService, useValue: {loadPemOrPath: (): null => null}},
			],
		}).compile();
		service = module.get(CdkRpcService);
	});
	afterEach(async () => {
		await module?.close();
		server.forceShutdown();
		jest.restoreAllMocks();
	});
	it('uses the split paths on one channel without the retired header, preserving uint64 and enums', async () => {
		const unary = jest.spyOn(Client.prototype, 'makeUnaryRequest');
		await service.request('GetInfo', {});
		await service.request('RotateNextKeyset', {unit: 'sat'});
		await service.request('UpdateDisabled', {mint_disabled: false});
		await expect(service.request('GetQuoteTtl', {})).resolves.toEqual({mint_ttl: '9007199254740993', melt_ttl: '60'});
		await service.request('GetBalance', {});
		await service.request('GetFederationInfo', {});
		await service.request('GetSetupStatus', {});
		await expect(service.request('UpdateMintQuoteState', {quote_id: 'q', state: 'MINT_QUOTE_STATE_PAID'})).resolves.toEqual({
			quote_id: 'q',
			state: 'MINT_QUOTE_STATE_PAID',
		});
		expect(new Set(unary.mock.contexts).size).toBe(1);
		expect(observed.every((call) => call.header.length === 0)).toBe(true);
		const disabled = observed.find((call) => call.method === 'UpdateDisabled');
		expect(disabled.request).toMatchObject({mint_disabled: false});
		expect(disabled.request).not.toHaveProperty('melt_disabled');
	});
	it('preserves the exact upstream diagnostic and maps precondition status', async () => {
		await expect(service.request('UpdateName', {name: 'mint'})).rejects.toMatchObject({
			code: OrchardErrorCode.MintRpcPreconditionError,
			grpc_code: status.FAILED_PRECONDITION,
			details: 'Configuration apply pending; restart cdk-mintd',
		});
	});
	it('terminates an unresponsive RPC at its deadline', async () => {
		await expect(service.request('UpdateMotd', {motd: 'test'}, 30)).rejects.toMatchObject({grpc_code: status.DEADLINE_EXCEEDED});
	});
	it('fails clearly when configured mTLS credentials are missing', async () => {
		config['cashu.rpc_mtls'] = true;
		await expect(service.request('GetInfo', {})).rejects.toThrow('MINT_RPC_KEY, MINT_RPC_CERT and MINT_RPC_CA');
	});
	it.each([
		[status.INVALID_ARGUMENT, OrchardErrorCode.MintRpcInvalidArgumentError],
		[status.RESOURCE_EXHAUSTED, OrchardErrorCode.MintRpcBusyError],
		[status.UNAVAILABLE, OrchardErrorCode.MintRpcConnectionError],
		[status.UNIMPLEMENTED, OrchardErrorCode.MintSupportError],
		[status.PERMISSION_DENIED, OrchardErrorCode.MintRpcActionError],
		[status.UNAUTHENTICATED, OrchardErrorCode.MintRpcActionError],
	])('maps gRPC %s without changing the diagnostic', (grpc_code, code) => {
		expect(new CdkRpcError(grpc_code, 'Exact CDK diagnostic')).toMatchObject({grpc_code, code, details: 'Exact CDK diagnostic'});
	});
});
