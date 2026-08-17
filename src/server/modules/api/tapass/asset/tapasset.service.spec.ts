/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {TaprootAssetsService} from '#server/modules/tapass/tapass/tapass.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {TaprootAssetsAssetService} from './tapasset.service.js';
import {OrchardTaprootAssets, OrchardTaprootAssetsUtxo} from './tapasset.model.js';

describe('TaprootAssetsAssetService', () => {
	let taprootAssetsAssetService: TaprootAssetsAssetService;
	let tapService: jest.Mocked<TaprootAssetsService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TaprootAssetsAssetService,
				{provide: TaprootAssetsService, useValue: {getListTaprootAssets: jest.fn(), getListTaprootAssetsUtxos: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		taprootAssetsAssetService = module.get<TaprootAssetsAssetService>(TaprootAssetsAssetService);
		tapService = module.get(TaprootAssetsService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(taprootAssetsAssetService).toBeDefined();
	});

	it('getTaprootAssets returns OrchardTaprootAssets', async () => {
		tapService.getListTaprootAssets.mockResolvedValue({
			assets: [
				{
					version: 0 as any,
					amount: '0',
					asset_group: null,
					is_spent: false,
					is_burn: false,
					asset_genesis: {
						genesis_point: '0:0',
						name: 'asset',
						asset_id: Buffer.alloc(32),
						asset_type: 0 as any,
						output_index: 0,
					},
					decimal_display: {decimal_display: 0},
				},
			],
			unconfirmed_transfers: '0',
			unconfirmed_mints: '0',
		} as any);
		const result = await taprootAssetsAssetService.getTaprootAssets('TAG');
		expect(result).toBeInstanceOf(OrchardTaprootAssets);
	});

	it('getTaprootAssetsUtxo returns OrchardTaprootAssetsUtxo[]', async () => {
		tapService.getListTaprootAssetsUtxos.mockResolvedValue({
			managed_utxos: {
				'txid:0': {
					amt_sat: '0',
					assets: [
						{
							version: 0 as any,
							amount: '0',
							asset_group: null,
							is_spent: false,
							is_burn: false,
							asset_genesis: {
								genesis_point: '0:0',
								name: 'asset',
								asset_id: Buffer.alloc(32),
								asset_type: 0 as any,
								output_index: 0,
							},
							decimal_display: {decimal_display: 0},
						},
					],
				},
			},
		} as any);
		const result = await taprootAssetsAssetService.getTaprootAssetsUtxo('TAG');
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeInstanceOf(OrchardTaprootAssetsUtxo);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		tapService.getListTaprootAssets.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.TaprootAssetsRpcActionError});
		await expect(taprootAssetsAssetService.getTaprootAssets('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.TaprootAssetsRpcActionError});
	});
});
