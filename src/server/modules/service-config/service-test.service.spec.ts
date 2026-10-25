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
	const bitcoin_rpc = {isConfigured: jest.fn(() => true), getBitcoinBlockchainInfo: jest.fn(async () => ({chain: 'main'}))};
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
		expect(result).toMatchObject({ok: false, diagnostic: '401 Unauthorized', fields: ['user', 'password']});
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
		const rpc = jest.spyOn(CdkRpcService.prototype, 'request');
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '8091', mtls: 'false'});
		expect(result).toMatchObject({ok: true, mode: 'setup'});
		expect(rpc).not.toHaveBeenCalled();
	});

	it('warns without blocking if RPC works and the database fails', async () => {
		jest.spyOn(FederationService.prototype, 'getMode').mockResolvedValue({mode: 'setup', details: null});
		jest.spyOn(CashuMintDatabaseService.prototype, 'getMintDatabase').mockRejectedValue(new Error('Unable to open database'));
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '8091', database: '/missing/mint.sqlite'});
		expect(result).toMatchObject({ok: true, warning: true, diagnostic: 'Unable to open database', fields: ['database']});
	});

	it('compares the actual Lightning network and closes the temporary client', async () => {
		const close = jest.fn();
		jest.spyOn(LndService.prototype, 'initializeLightningClient').mockReturnValue({
			getChannel: () => ({close}),
			GetInfo: (_request: object, _metadata: unknown, _options: unknown, callback: (error: null, result: object) => void) =>
				callback(null, {chains: [{network: 'mainnet'}]}),
		} as unknown as Client);
		const result = await service.test('lightning', {type: 'lnd', host: 'localhost', port: '10009', macaroon: 'aabb', cert: 'inline'});
		expect(result.chain_match).toBe(true);
		expect(bitcoin_rpc.getBitcoinBlockchainInfo).toHaveBeenCalled();
		expect(close).toHaveBeenCalled();
	});

	it('flags the field Orchard rejected before contacting the node', async () => {
		const result = await service.test('mint', {type: 'cdk', host: 'localhost', port: '99999', mtls: 'false'});
		expect(result).toMatchObject({ok: false, diagnostic: 'Invalid RPC port', fields: ['port']});
	});
});
