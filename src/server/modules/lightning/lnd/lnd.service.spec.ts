/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {mockGrpcModules} from '@server/test/grpc-esm-mocks';
import {CredentialService} from '@server/modules/credential/credential.service';
/* Local Dependencies */
import type {LndService as LndServiceType} from './lnd.service.js';

const {proto_loader, grpc} = await mockGrpcModules();
const {LndService} = await import('./lnd.service.js');

describe('LndService', () => {
	let lndService: LndServiceType;
	let configService: jest.Mocked<ConfigService>;
	let credentialService: jest.Mocked<CredentialService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LndService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CredentialService, useValue: {loadMacaroonHex: jest.fn(), loadPemOrPath: jest.fn()}},
			],
		}).compile();

		lndService = module.get(LndService);
		configService = module.get(ConfigService);
		credentialService = module.get(CredentialService);
	});

	it('should be defined', () => {
		expect(lndService).toBeDefined();
	});

	it('returns undefined client when credentials missing', () => {
		const client = lndService.initializeLightningClient();
		expect(client).toBeUndefined();
	});

	it('initializes client when credentials present', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'lightning.host':
					return 'localhost';
				case 'lightning.port':
					return 10009;
				case 'lightning.macaroon':
					return 'hex:00';
				case 'lightning.cert':
					return 'CERT';
				default:
					return undefined as any;
			}
		});
		credentialService.loadMacaroonHex.mockReturnValue('00');
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('cert'));
		const createFromMetadataGenerator = jest.spyOn(grpc.credentials, 'createFromMetadataGenerator').mockReturnValue({} as any);
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		const combine = jest.spyOn(grpc.credentials, 'combineChannelCredentials').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue({});
		grpc.loadPackageDefinition.mockReturnValue({lnrpc: {Lightning: jest.fn()}, walletrpc: {WalletKit: jest.fn()}});
		lndService.initializeLightningClient();
		lndService.initializeWalletKitClient();
		expect(createFromMetadataGenerator).toHaveBeenCalled();
		expect(createSsl).toHaveBeenCalled();
		expect(combine).toHaveBeenCalled();
		expect(proto_loader.loadSync).toHaveBeenCalled();
		expect(grpc.loadPackageDefinition).toHaveBeenCalled();
	});

	it('mapLndRequest constructs a LightningRequest', () => {
		const req = {description: 'x', expiry: 60};
		const out = lndService.mapLndRequest(req as any);
		expect(out.valid).toBe(true);
		expect(out.description).toBeDefined();
	});
});
