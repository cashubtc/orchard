/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {LightningBalanceService} from './lnbalance.service.js';
import {OrchardLightningBalance} from './lnbalance.model.js';

describe('LightningBalanceService', () => {
	let lightningBalanceService: LightningBalanceService;
	let lightningService: jest.Mocked<LightningService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningBalanceService,
				{
					provide: LightningService,
					useValue: {getChannels: jest.fn().mockResolvedValue([]), getLightningChannelBalance: jest.fn()},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		lightningBalanceService = module.get<LightningBalanceService>(LightningBalanceService);
		lightningService = module.get(LightningService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(lightningBalanceService).toBeDefined();
	});

	it('returns OrchardLightningBalance on success', async () => {
		// Arrange: minimal valid LightningChannelBalance shape
		lightningService.getLightningChannelBalance.mockResolvedValue({
			balance: '0',
			pending_open_balance: '0',
			local_balance: {sat: '0', msat: '0'},
			remote_balance: {sat: '0', msat: '0'},
			unsettled_local_balance: {sat: '0', msat: '0'},
			unsettled_remote_balance: {sat: '0', msat: '0'},
			pending_open_local_balance: {sat: '0', msat: '0'},
			pending_open_remote_balance: {sat: '0', msat: '0'},
			custom_channel_data: Buffer.alloc(0),
		} as any);

		// Act
		const result = await lightningBalanceService.getLightningChannelBalance('TAG');

		// Assert
		expect(result).toBeInstanceOf(OrchardLightningBalance);
		expect(lightningService.getLightningChannelBalance).toHaveBeenCalledTimes(1);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		// Arrange
		const rpc_error = new Error('boom');
		lightningService.getLightningChannelBalance.mockRejectedValue(rpc_error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		// Act
		await expect(lightningBalanceService.getLightningChannelBalance('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);

		// Assert
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.LightningRpcActionError});
	});
});
