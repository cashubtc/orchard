/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletService} from '#server/modules/cashu/wallet/cashuwallet.service';
import {UserService} from '#server/modules/user/user.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashSeedService} from './ecashseed.service.js';

describe('EcashSeedService', () => {
	let ecashSeedService: EcashSeedService;
	let cashuWalletService: jest.Mocked<CashuWalletService>;
	let userService: jest.Mocked<UserService>;
	let errorService: jest.Mocked<ErrorService>;

	const user: any = {id: 'user-1', password_hash: 'hash'};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashSeedService,
				{provide: CashuWalletService, useValue: {getSeedStatus: jest.fn(), getMnemonic: jest.fn(), markBackedUp: jest.fn()}},
				{provide: UserService, useValue: {getUserById: jest.fn(), validatePassword: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashSeedService = module.get<EcashSeedService>(EcashSeedService);
		cashuWalletService = module.get(CashuWalletService);
		userService = module.get(UserService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashSeedService).toBeDefined();
	});

	it('getEcashSeed returns null before the wallet has a seed', async () => {
		cashuWalletService.getSeedStatus.mockResolvedValue(null);
		await expect(ecashSeedService.getEcashSeed('TAG', 'user-1')).resolves.toBeNull();
	});

	it('revealEcashSeed returns the mnemonic for the right password', async () => {
		userService.getUserById.mockResolvedValue(user);
		userService.validatePassword.mockResolvedValue(true);
		cashuWalletService.getMnemonic.mockResolvedValue('abandon about');
		await expect(ecashSeedService.revealEcashSeed('TAG', 'user-1', 'secret')).resolves.toBe('abandon about');
	});

	it('revealEcashSeed refuses a wrong password without touching the seed', async () => {
		userService.getUserById.mockResolvedValue(user);
		userService.validatePassword.mockResolvedValue(false);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InvalidPasswordError});
		await expect(ecashSeedService.revealEcashSeed('TAG', 'user-1', 'wrong')).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), OrchardErrorCode.InvalidPasswordError, 'TAG', {
			errord: OrchardErrorCode.EcashWalletError,
		});
		expect(cashuWalletService.getMnemonic).not.toHaveBeenCalled();
	});

	it('backupEcashSeed returns the stamped status', async () => {
		cashuWalletService.markBackedUp.mockResolvedValue({created_at: 1, backed_up_at: 2});
		await expect(ecashSeedService.backupEcashSeed('TAG', 'user-1')).resolves.toEqual({created_at: 1, backed_up_at: 2});
	});
});
