/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {LightningWalletKitService} from '#server/modules/lightning/walletkit/lnwalletkit.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {LightningWalletService} from './lnwallet.service.js';
import {OrchardLightningAccount} from './lnwallet.model.js';

describe('LightningWalletService', () => {
	let lightningWalletService: LightningWalletService;
	let walletkitService: jest.Mocked<LightningWalletKitService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningWalletService,
				{provide: LightningWalletKitService, useValue: {getLightningAddresses: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		lightningWalletService = module.get<LightningWalletService>(LightningWalletService);
		walletkitService = module.get(LightningWalletKitService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(lightningWalletService).toBeDefined();
	});

	it('returns OrchardLightningAccount[] on success', async () => {
		walletkitService.getLightningAddresses.mockResolvedValue({
			account_with_addresses: [
				{
					name: 'bech32',
					address_type: 0,
					derivation_path: '',
					addresses: [{address: 'x', is_internal: 'false', balance: 0, derivation_path: '', public_key: Buffer.alloc(0)}],
				},
			],
		} as any);
		const result = await lightningWalletService.getListAccounts('TAG');
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeInstanceOf(OrchardLightningAccount);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		walletkitService.getLightningAddresses.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});
		await expect(lightningWalletService.getListAccounts('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.LightningRpcActionError});
	});
});
