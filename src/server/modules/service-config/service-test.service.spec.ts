import {ConfigService} from '@nestjs/config';
import {CoreService} from '#server/modules/bitcoin/core/core.service';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CredentialService} from '#server/modules/credential/credential.service';
import {FederationService} from '#server/modules/federation/federation.service';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import type {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import type {Client} from '@grpc/grpc-js';
import {ServiceTestService} from './service-test.service.js';

describe('ServiceTestService', () => {
	const config = new ConfigService({bitcoin: {type: 'core', host: 'localhost', port: '8332'}});
	const bitcoin_rpc = {isConfigured: jest.fn(() => true)};
	const pem = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
	const macaroon = '0201036c6e64';
	const mint_details = {database: '/missing/mint.sqlite', api: 'https://mint.test'};
	let service: ServiceTestService;
	beforeEach(() => {
		service = new ServiceTestService(
			config,
			new FetchService(new ConfigService()),
			new CredentialService(),
			bitcoin_rpc as unknown as BitcoinRpcService,
		);
	});
	afterEach(() => jest.restoreAllMocks());

	it('retains the upstream Bitcoin diagnostic and flags authentication fields', async () => {
		jest.spyOn(CoreService.prototype, 'makeRpcRequest').mockRejectedValue(new Error('401 Unauthorized'));
		const result = await service.test('bitcoin', {type: 'core', host: 'localhost', port: '8332', password: 'secret'});
		expect(result).toMatchObject({ok: false, saved: false, diagnostic: '401 Unauthorized', fields: ['user', 'password']});
	});

	it('names the host Orchard dialled after the Docker rewrite', async () => {
		const docker_env = process.env.DOCKER_ENV;
		process.env.DOCKER_ENV = 'true';
		try {
			jest.spyOn(CoreService.prototype, 'makeRpcRequest').mockResolvedValue({chain: 'regtest'});
			const result = await service.test('bitcoin', {type: 'core', host: 'localhost', port: '8332'});
			expect(result.context).toBe('host.docker.internal:8332 · HTTP RPC');
		} finally {
			process.env.DOCKER_ENV = docker_env;
		}
	});

	it('does not expose a credential echoed by an upstream error', async () => {
		jest.spyOn(CoreService.prototype, 'makeRpcRequest').mockRejectedValue(new Error('Rejected password very-private'));
		const result = await service.test('bitcoin', {type: 'core', host: 'localhost', port: '8332', password: 'very-private'});
		expect(result.diagnostic).toBe('Rejected password [redacted]');
	});

	it('flags a credential path named in a file error without changing the diagnostic', async () => {
		const diagnostic = "ENOENT: no such file or directory, open '/missing/client.pem'";
		jest.spyOn(CredentialService.prototype, 'loadPemOrPath').mockImplementation(() => {
			throw new Error(diagnostic);
		});
		const result = await service.test('lightning', {
			type: 'lnd',
			host: 'localhost',
			port: '10009',
			macaroon: 'aabb',
			cert: '/missing/client.pem',
		});
		expect(result).toMatchObject({ok: false, diagnostic, fields: ['cert']});
	});

	it('accepts setup mode without requiring management GetInfo', async () => {
		jest.spyOn(FederationService.prototype, 'getMode').mockResolvedValue({mode: 'setup', details: null});
		jest.spyOn(CashuMintDatabaseService.prototype, 'getMintDatabase').mockRejectedValue(new Error('Unable to open database'));
		const rpc = jest.spyOn(CdkRpcService.prototype, 'request');
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '8091', mtls: 'false', ...mint_details});
		expect(result).toMatchObject({ok: true, mode: 'setup'});
		expect(rpc).not.toHaveBeenCalled();
	});

	it('warns without blocking if RPC works and the database fails', async () => {
		jest.spyOn(FederationService.prototype, 'getMode').mockResolvedValue({mode: 'setup', details: null});
		jest.spyOn(CashuMintDatabaseService.prototype, 'getMintDatabase').mockRejectedValue(new Error('Unable to open database'));
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '8091', ...mint_details});
		expect(result).toMatchObject({ok: true, warning: true, diagnostic: 'Unable to open database', fields: ['database']});
	});

	it('requires the mint database and public URL once the RPC has answered', async () => {
		jest.spyOn(FederationService.prototype, 'getMode').mockResolvedValue({mode: 'setup', details: null});
		const values = {type: 'cdk', host: 'localhost', port: '8091', database: '/data/mint.sqlite'};
		expect(await service.test('mint', values)).toMatchObject({
			ok: false,
			mode: 'setup',
			title: 'Mint details missing',
			diagnostic: 'Missing public mint URL',
			fields: ['api'],
		});
		expect(service.isValid('mint', values)).toBe(false);
		expect(service.isValid('mint', {...values, api: 'https://mint.test'})).toBe(true);
	});

	it('compares the actual Lightning network within the test timeout and closes the temporary client', async () => {
		const close = jest.fn();
		jest.spyOn(LndService.prototype, 'initializeLightningClient').mockReturnValue({
			getChannel: () => ({close}),
			GetInfo: (_request: object, _metadata: unknown, _options: unknown, callback: (error: null, result: object) => void) =>
				callback(null, {chains: [{network: 'mainnet'}]}),
		} as unknown as Client);
		const rpc = jest.spyOn(CoreService.prototype, 'makeRpcRequest').mockResolvedValue({chain: 'main'});
		const result = await service.test('lightning', {type: 'lnd', host: 'localhost', port: '10009', macaroon, cert: pem});
		expect(result.chain_match).toBe(true);
		expect(rpc).toHaveBeenCalledWith('getblockchaininfo', [], 5000);
		expect(close).toHaveBeenCalled();
	});

	it('refuses a credential that is not a certificate, key or macaroon', async () => {
		jest.spyOn(CredentialService.prototype, 'loadPemOrPath').mockReturnValue(Buffer.from('not a certificate'));
		const values = {type: 'lnd', host: 'localhost', port: '10009', macaroon, cert: '/data/orchard.key'};
		await expect(service.test('lightning', values)).resolves.toMatchObject({ok: false, fields: ['cert']});
		expect(service.isValid('lightning', values)).toBe(false);
		jest.restoreAllMocks();
		expect(service.isValid('lightning', {...values, cert: pem, macaroon: 'aabb'})).toBe(false);
	});

	it('returns Bitcoin version and block height from bounded RPC reads', async () => {
		const rpc = jest
			.spyOn(CoreService.prototype, 'makeRpcRequest')
			.mockImplementation(async (method) =>
				method === 'getnetworkinfo' ? {subversion: '/Satoshi:28.1.0/'} : {chain: 'signet', blocks: 210000},
			);
		const result = await service.test('bitcoin', {type: 'core', host: 'node', port: '38332'});
		expect(result).toMatchObject({
			ok: true,
			bitcoin_version: '28.1.0',
			chain: 'signet',
			bitcoin_blocks: 210000,
			mint_member_id: null,
			mint_member_count: null,
		});
		expect(rpc).toHaveBeenCalledWith('getnetworkinfo', [], 5000);
	});

	it('returns federation membership metadata and releases the isolated RPC client', async () => {
		jest.spyOn(FederationService.prototype, 'getMode').mockResolvedValue({mode: 'member', details: null});
		jest.spyOn(CashuMintDatabaseService.prototype, 'getMintDatabase').mockRejectedValue(new Error('Unable to open database'));
		const info = {local_member_id: 3, threshold_params: {member_count: 5}};
		const rpc = jest.spyOn(CdkRpcService.prototype, 'request').mockResolvedValue(info as never);
		const close = jest.spyOn(CdkRpcService.prototype, 'onModuleDestroy');
		expect(await service.test('mint', {type: 'cdk', host: 'mint', port: '8091', ...mint_details})).toMatchObject({
			ok: true,
			mode: 'member',
			mint_member_id: 3,
			mint_member_count: 5,
		});
		expect(rpc).toHaveBeenCalledWith('GetFederationInfo', {}, 5000);
		expect(close).toHaveBeenCalled();
	});

	it('gives certificate failures a TLS title and preserves the upstream diagnostic', async () => {
		const diagnostic = 'self-signed certificate in certificate chain';
		jest.spyOn(CoreService.prototype, 'makeRpcRequest').mockRejectedValue(new Error(diagnostic));
		expect(await service.test('bitcoin', {type: 'core', host: 'node', port: '8332'})).toMatchObject({
			ok: false,
			title: 'TLS connection failed',
			diagnostic,
			fields: ['host'],
		});
	});

	it('flags the field Orchard rejected before contacting the node', async () => {
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '99999', mtls: 'false'});
		expect(result).toMatchObject({ok: false, diagnostic: 'Invalid RPC port', fields: ['port']});
	});
});
