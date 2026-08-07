/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {LightningRequestService} from './lnrequest.service.js';
import {OrchardLightningRequest} from './lnrequest.model.js';

describe('LightningRequestService', () => {
	let lightningRequestService: LightningRequestService;
	let lightningService: jest.Mocked<LightningService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningRequestService,
				{provide: LightningService, useValue: {getLightningRequest: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		lightningRequestService = module.get<LightningRequestService>(LightningRequestService);
		lightningService = module.get(LightningService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(lightningRequestService).toBeDefined();
	});

	it('returns OrchardLightningRequest on success', async () => {
		// Arrange
		lightningService.getLightningRequest.mockResolvedValue({} as any);

		// Act
		const result = await lightningRequestService.getLightningRequest('TAG', 'REQ');

		// Assert
		expect(result).toBeInstanceOf(OrchardLightningRequest);
		expect(lightningService.getLightningRequest).toHaveBeenCalledWith('REQ');
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		// Arrange
		const rpc_error = new Error('boom');
		lightningService.getLightningRequest.mockRejectedValue(rpc_error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		// Act
		await expect(lightningRequestService.getLightningRequest('MY_TAG', 'REQ')).rejects.toBeInstanceOf(OrchardApiError);

		// Assert
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.LightningRpcActionError});
	});
});
