/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {TaprootAssetsService} from '#server/modules/tapass/tapass/tapass.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {TaprootAssetsInfoService} from './tapinfo.service.js';
import {OrchardTaprootAssetsInfo} from './tapinfo.model.js';

describe('TaprootAssetsInfoService', () => {
	let taprootAssetsInfoService: TaprootAssetsInfoService;
	let tapService: jest.Mocked<TaprootAssetsService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TaprootAssetsInfoService,
				{provide: TaprootAssetsService, useValue: {getTaprootAssetsInfo: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		taprootAssetsInfoService = module.get<TaprootAssetsInfoService>(TaprootAssetsInfoService);
		tapService = module.get(TaprootAssetsService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(taprootAssetsInfoService).toBeDefined();
	});

	it('returns OrchardTaprootAssetsInfo on success', async () => {
		tapService.getTaprootAssetsInfo.mockResolvedValue({} as any);
		const result = await taprootAssetsInfoService.getTaprootAssetsInfo('TAG');
		expect(result).toBeInstanceOf(OrchardTaprootAssetsInfo);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		tapService.getTaprootAssetsInfo.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.TaprootAssetsRpcActionError});
		await expect(taprootAssetsInfoService.getTaprootAssetsInfo('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.TaprootAssetsRpcActionError});
	});
});
