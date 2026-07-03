/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {LightningInfoService} from './lninfo.service';
import {OrchardLightningInfo} from './lninfo.model';

describe('LightningInfoService', () => {
	let module_ref: TestingModule;
	let lightningInfoService: LightningInfoService;
	let lightningService: jest.Mocked<LightningService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningInfoService,
				{provide: LightningService, useValue: {getLightningInfo: jest.fn(), getLightningRequest: jest.fn()}},
				{provide: CashuMintDatabaseService, useValue: {listMintQuotes: jest.fn().mockResolvedValue([])}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: ConfigService, useValue: {get: jest.fn().mockReturnValue(null)}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		module_ref = module;
		lightningInfoService = module.get<LightningInfoService>(LightningInfoService);
		lightningService = module.get(LightningService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(lightningInfoService).toBeDefined();
	});

	it('returns OrchardLightningInfo on success', async () => {
		// Arrange
		const rpc_info: any = {
			version: 'v',
			commit_hash: '',
			identity_pubkey: 'pub',
			alias: 'alias',
			color: '#000000',
			num_pending_channels: 0,
			num_active_channels: 0,
			num_inactive_channels: 0,
			num_peers: 0,
			block_height: 0,
			block_hash: '',
			best_header_timestamp: 0,
			synced_to_chain: true,
			synced_to_graph: true,
			testnet: false,
			chains: [],
			uris: [],
			require_htlc_interceptor: false,
			store_final_htlc_resolutions: false,
			features: {},
		};
		lightningService.getLightningInfo.mockResolvedValue(rpc_info);

		// Act
		const result = await lightningInfoService.getLightningInfo('TAG');

		// Assert
		expect(result).toBeInstanceOf(OrchardLightningInfo);
		expect(lightningService.getLightningInfo).toHaveBeenCalledTimes(1);
	});

	it('determines the mint backend from the most recent lightning quote, skipping onchain quotes', async () => {
		// Arrange
		const rpc_info: any = {identity_pubkey: 'pub', chains: [], uris: [], features: {}};
		lightningService.getLightningInfo.mockResolvedValue(rpc_info);
		const config_service = module_ref.get(ConfigService) as jest.Mocked<ConfigService>;
		(config_service.get as jest.Mock).mockReturnValue('set');
		const mint_db = module_ref.get(CashuMintDatabaseService) as jest.Mocked<CashuMintDatabaseService>;
		(mint_db.listMintQuotes as jest.Mock).mockResolvedValue([
			{payment_method: 'onchain', request: 'bcrt1qexampleonchainaddress'},
			{payment_method: 'bolt12', request: 'lno1exampleoffer'},
			{payment_method: 'bolt11', request: 'lnbcrt500n1examplebolt11'},
		]);
		lightningService.getLightningRequest.mockResolvedValue({destination: 'pub'} as any);

		// Act
		const result = await lightningInfoService.getLightningInfo('TAG');

		// Assert
		expect(result.backend).toBe(true);
		expect(lightningService.getLightningRequest).toHaveBeenCalledTimes(1);
		expect(lightningService.getLightningRequest).toHaveBeenCalledWith('lno1exampleoffer');
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		// Arrange
		const rpc_error = new Error('boom');
		lightningService.getLightningInfo.mockRejectedValue(rpc_error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		// Act
		await expect(lightningInfoService.getLightningInfo('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);

		// Assert
		expect(errorService.resolveError).toHaveBeenCalled();
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.LightningRpcActionError});
	});
});
