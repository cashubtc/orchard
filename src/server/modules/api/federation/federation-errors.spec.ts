/* Core Dependencies */
import {Test, type TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import {CredentialService} from '#server/modules/credential/credential.service';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {CdkRpcError} from '#server/modules/cashu/cdk/classes/cdk-rpc-error.class';
import {FederationService} from '#server/modules/federation/federation.service';
import {FederationSetupService} from '#server/modules/federation/federation-setup.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';

/* Local Dependencies */
import {FederationResolver} from './federation.resolver.js';
import {FederationSetupResolver} from './federation-setup.resolver.js';

describe('Federation resolver error boundaries', () => {
	let module: TestingModule;
	let reads: FederationResolver;
	let setup: FederationSetupResolver;
	const get = jest.fn();

	beforeEach(async () => {
		get.mockReset();
		module = await Test.createTestingModule({
			providers: [
				FederationResolver,
				FederationSetupResolver,
				FederationService,
				FederationSetupService,
				CdkRpcService,
				ErrorService,
				{provide: ConfigService, useValue: {get}},
				{provide: CredentialService, useValue: {loadPemOrPath: jest.fn()}},
			],
		}).compile();
		reads = module.get(FederationResolver);
		setup = module.get(FederationSetupResolver);
	});

	afterEach(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	it.each([
		[status.INVALID_ARGUMENT, OrchardErrorCode.MintRpcInvalidArgumentError],
		[status.FAILED_PRECONDITION, OrchardErrorCode.MintRpcPreconditionError],
		[status.RESOURCE_EXHAUSTED, OrchardErrorCode.MintRpcBusyError],
		[status.UNIMPLEMENTED, OrchardErrorCode.MintSupportError],
		[status.UNAVAILABLE, OrchardErrorCode.MintRpcConnectionError],
		[status.DEADLINE_EXCEEDED, OrchardErrorCode.MintRpcConnectionError],
		[status.INTERNAL, OrchardErrorCode.MintRpcInternalError],
		[status.PERMISSION_DENIED, OrchardErrorCode.MintRpcActionError],
	])('maps gRPC %s through read() and call() with its diagnostic unchanged', async (grpc_code, code) => {
		const details = 'Exact CDK diagnostic: member 3 cannot continue';
		jest.spyOn(module.get(CdkRpcService), 'request').mockRejectedValue(new CdkRpcError(grpc_code, details));
		const expected = {extensions: {code, details}};
		await expect(reads.federation_info()).rejects.toMatchObject(expected);
		await expect(setup.getStatus()).rejects.toMatchObject(expected);
		await expect(setup.review()).rejects.toMatchObject(expected);
		await expect(setup.join({invitation: 'secret'})).rejects.toMatchObject(expected);
	});

	it('uses the action error fallback for an unmapped upstream error', async () => {
		jest.spyOn(module.get(CdkRpcService), 'request').mockRejectedValue({code: -1, details: 'Original failure'});
		const expected = {extensions: {code: OrchardErrorCode.MintRpcActionError, details: 'Original failure'}};
		await expect(reads.federation_local_status()).rejects.toMatchObject(expected);
		await expect(setup.approve('hash')).rejects.toMatchObject(expected);
	});

	it('maps non-gRPC getClient failures through both resolvers without losing the message', async () => {
		get.mockImplementation(() => {
			throw new Error('Could not load mint RPC configuration');
		});
		const expected = {extensions: {code: OrchardErrorCode.MintRpcConnectionError, details: 'Could not load mint RPC configuration'}};
		await expect(reads.federation_info()).rejects.toMatchObject(expected);
		await expect(setup.getStatus()).rejects.toMatchObject(expected);
		await expect(setup.create({members: 3, threshold: 2, network: 'regtest'})).rejects.toMatchObject(expected);
	});
});
