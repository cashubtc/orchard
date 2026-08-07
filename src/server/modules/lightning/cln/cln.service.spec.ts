/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {mockGrpcModules} from '@server/test/grpc-esm-mocks';
import {CredentialService} from '@server/modules/credential/credential.service';
/* Local Dependencies */
import type {ClnService as ClnServiceType} from './cln.service.js';

const {proto_loader, grpc} = await mockGrpcModules();
const {ClnService} = await import('./cln.service.js');

describe('ClnService', () => {
	let clnService: ClnServiceType;
	let configService: jest.Mocked<ConfigService>;
	let credentialService: jest.Mocked<CredentialService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ClnService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CredentialService, useValue: {loadPemOrPath: jest.fn()}},
			],
		}).compile();

		clnService = module.get(ClnService);
		configService = module.get(ConfigService);
		credentialService = module.get(CredentialService);
	});

	it('should be defined', () => {
		expect(clnService).toBeDefined();
	});

	it('returns undefined client when credentials missing', () => {
		const client = clnService.initializeLightningClient();
		expect(client).toBeUndefined();
	});

	it('initializes mTLS client when credentials present', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'lightning.host':
					return 'cln';
				case 'lightning.port':
					return 9999;
				case 'lightning.cert':
					return 'CERT';
				case 'lightning.key':
					return 'KEY';
				case 'lightning.ca':
					return 'CA';
				default:
					return undefined as any;
			}
		});
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('x'));
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue({});
		grpc.loadPackageDefinition.mockReturnValue({cln: {Node: jest.fn()}});
		clnService.initializeLightningClient();
		expect(createSsl).toHaveBeenCalled();
		expect(proto_loader.loadSync).toHaveBeenCalled();
		expect(grpc.loadPackageDefinition).toHaveBeenCalled();
	});

	it('mapClnInfo maps fields and uris correctly', async () => {
		const info = {
			id: Buffer.from('aabb', 'hex'),
			color: '#AABBCC',
			network: 'regtest',
			address: [{address: '127.0.0.1', port: 9735}],
			version: 'v',
			alias: 'my',
			num_pending_channels: 1,
			num_active_channels: 2,
			num_inactive_channels: 3,
			num_peers: 4,
			blockheight: 5,
		};
		const out = await clnService.mapClnInfo(info);
		expect(out.identity_pubkey).toBe('aabb');
		// Canonical color format is '#rrggbb' (CSS-bindable, matching lnd's
		// passthrough) regardless of whether cln emitted the leading '#'.
		expect(out.color).toBe('#aabbcc');
		expect(out.testnet).toBe(true);
		expect(out.uris[0]).toMatch(/@127.0.0.1:9735$/);
	});

	it('mapClnAddresses groups bech32 and p2tr with balances', () => {
		const addresses = {
			addresses: [{bech32: 'b1'}, {p2tr: 't1'}],
		};
		const funds = {
			outputs: [
				{address: 'b1', amount_msat: {msat: 50000000}}, // 50000 sats
				{address: 'b1', amount_msat: {msat: 30000000}}, // 30000 sats
				{address: 't1', amount_msat: 10000000}, // 10000 sats (raw format)
			],
		};
		const out = clnService.mapClnAddresses(addresses, funds);
		expect(out.account_with_addresses.length).toBe(2);
		expect(out.account_with_addresses[0].addresses[0].address).toBe('b1');
		expect(out.account_with_addresses[0].addresses[0].balance).toBe(80000); // 50000 + 30000
		expect(out.account_with_addresses[1].addresses[0].address).toBe('t1');
		expect(out.account_with_addresses[1].addresses[0].balance).toBe(10000);
	});

	it('mapClnRequest maps validity and description', () => {
		const req = {item_type: 'offer', valid: true, description: 'hello'};
		const out = clnService.mapClnRequest(req);
		expect(out.valid).toBe(true);
		expect(out.description).toBeDefined();
	});
});
