/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {CredentialService} from '@server/modules/credential/credential.service';
/* Local Dependencies */
import {TapdService} from './tapd.service.js';
import * as grpc from '@grpc/grpc-js';

describe('TapdService', () => {
	let tapdService: TapdService;
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

		tapdService = module.get<TapdService>(TapdService);
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
		const loadSync = jest.spyOn(require('@grpc/proto-loader'), 'loadSync').mockReturnValue({} as any);
		const client_ctor = jest.fn();
		const loadPackageDefinition = jest
			.spyOn(grpc, 'loadPackageDefinition')
			.mockReturnValue({taprpc: {TaprootAssets: client_ctor}} as any);

		tapdService.initializeTaprootAssetsClient();

		expect(createFromMetadataGenerator).toHaveBeenCalled();
		expect(createSsl).toHaveBeenCalled();
		expect(combine).toHaveBeenCalled();
		expect(loadSync).toHaveBeenCalled();
		expect(loadPackageDefinition).toHaveBeenCalled();
		expect(client_ctor).toHaveBeenCalled();
		metadata_add.mockRestore();
	});
});
