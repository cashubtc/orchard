/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {mockGrpcModules} from '@server/test/grpc-esm-mocks';
import {CredentialService} from '@server/modules/credential/credential.service';
/* Local Dependencies */
import type {TapdService as TapdServiceType} from './tapd.service.js';

const {proto_loader, grpc} = await mockGrpcModules();
const {TapdService} = await import('./tapd.service.js');

describe('TapdService', () => {
	let tapdService: TapdServiceType;
	let configService: jest.Mocked<ConfigService>;
	let credentialService: jest.Mocked<CredentialService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TapdService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CredentialService, useValue: {loadMacaroonHex: jest.fn(), loadPemOrPath: jest.fn()}},
			],
		}).compile();

		tapdService = module.get(TapdService);
		configService = module.get(ConfigService);
		credentialService = module.get(CredentialService);
	});

	it('should be defined', () => {
		expect(tapdService).toBeDefined();
	});

	it('returns undefined client when credentials missing', () => {
		configService.get.mockReturnValueOnce(undefined);
		configService.get.mockReturnValueOnce(undefined);
		configService.get.mockReturnValueOnce(undefined);
		configService.get.mockReturnValueOnce(undefined);
		const client = tapdService.initializeTaprootAssetsClient();
		expect(client).toBeUndefined();
	});

	it('initializes client when credentials present', () => {
		// Provide config
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'taproot_assets.host':
					return 'localhost';
				case 'taproot_assets.port':
					return 10029;
				case 'taproot_assets.macaroon':
					return 'hex:00';
				case 'taproot_assets.cert':
					return '-----BEGIN CERT-----\nX\n-----END CERT-----';
				default:
					return undefined as any;
			}
		});
		credentialService.loadMacaroonHex.mockReturnValue('00');
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('cert'));

		// Spy on grpc to avoid real calls
		const metadata_add = jest.spyOn((grpc.Metadata as any).prototype, 'add').mockImplementation(() => undefined);
		const createFromMetadataGenerator = jest.spyOn(grpc.credentials, 'createFromMetadataGenerator').mockReturnValue({} as any);
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		const combine = jest.spyOn(grpc.credentials, 'combineChannelCredentials').mockReturnValue({} as any);

		// Mock loadPackageDefinition -> namespace and client constructor
		proto_loader.loadSync.mockReturnValue({});
		const client_ctor = jest.fn();
		grpc.loadPackageDefinition.mockReturnValue({taprpc: {TaprootAssets: client_ctor}});

		tapdService.initializeTaprootAssetsClient();

		expect(createFromMetadataGenerator).toHaveBeenCalled();
		expect(createSsl).toHaveBeenCalled();
		expect(combine).toHaveBeenCalled();
		expect(proto_loader.loadSync).toHaveBeenCalled();
		expect(grpc.loadPackageDefinition).toHaveBeenCalled();
		expect(client_ctor).toHaveBeenCalled();
		metadata_add.mockRestore();
	});
});
