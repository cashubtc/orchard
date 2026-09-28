/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {mnemonicToSeedSync} from '@scure/bip39';
/* Application Dependencies */
import {deriveEncryptionKeyFromHex, encryptValue, decryptValue} from '#server/modules/setting/setting.helpers';
/* Local Dependencies */
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletSeed} from './cashuwalletseed.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {WalletProofState} from './cashuwallet.enums.js';

describe('CashuWalletService', () => {
	let service: CashuWalletService;

	const test_crypto_key = 'ab'.repeat(32);
	const test_mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

	const mock_seed_repository = {findOne: jest.fn(), insert: jest.fn()};
	const mock_query_builder: any = {
		select: jest.fn().mockReturnThis(),
		addSelect: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		groupBy: jest.fn().mockReturnThis(),
		addGroupBy: jest.fn().mockReturnThis(),
		getRawMany: jest.fn(),
	};
	const mock_proof_repository = {createQueryBuilder: jest.fn(() => mock_query_builder)};
	const mock_config_service = {get: jest.fn()};

	beforeEach(async () => {
		jest.clearAllMocks();
		mock_config_service.get.mockImplementation((key: string) => (key === 'server.crypto_key' ? test_crypto_key : undefined));

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletService,
				{provide: getRepositoryToken(CashuWalletSeed), useValue: mock_seed_repository},
				{provide: getRepositoryToken(CashuWalletProof), useValue: mock_proof_repository},
				{provide: ConfigService, useValue: mock_config_service},
			],
		}).compile();

		service = module.get<CashuWalletService>(CashuWalletService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getSeed', () => {
		it('creates and stores an encrypted mnemonic on first use', async () => {
			mock_seed_repository.findOne.mockResolvedValue(null);
			const seed = await service.getSeed('user-1');
			const stored = mock_seed_repository.insert.mock.calls[0][0] as CashuWalletSeed;
			const mnemonic = decryptValue(stored.mnemonic, deriveEncryptionKeyFromHex(test_crypto_key));
			expect(stored.user_id).toBe('user-1');
			expect(stored.mnemonic.startsWith('enc:')).toBe(true);
			expect(mnemonic.split(' ')).toHaveLength(12);
			expect(seed).toEqual(mnemonicToSeedSync(mnemonic));
		});

		it('decrypts the stored mnemonic into its seed', async () => {
			const encrypted = encryptValue(test_mnemonic, deriveEncryptionKeyFromHex(test_crypto_key));
			mock_seed_repository.findOne.mockResolvedValue({user_id: 'user-1', mnemonic: encrypted, created_at: 0});
			const seed = await service.getSeed('user-1');
			expect(seed).toEqual(mnemonicToSeedSync(test_mnemonic));
			expect(mock_seed_repository.insert).not.toHaveBeenCalled();
		});

		it('caches the seed per user', async () => {
			mock_seed_repository.findOne.mockResolvedValue(null);
			await service.getSeed('user-1');
			await service.getSeed('user-1');
			await service.getSeed('user-2');
			expect(mock_seed_repository.findOne).toHaveBeenCalledTimes(2);
		});

		it('throws an actionable error when the crypto key changed', async () => {
			const encrypted = encryptValue(test_mnemonic, deriveEncryptionKeyFromHex('cd'.repeat(32)));
			mock_seed_repository.findOne.mockResolvedValue({user_id: 'user-1', mnemonic: encrypted, created_at: 0});
			await expect(service.getSeed('user-1')).rejects.toThrow('crypto.key or CRYPTO_KEY changed');
		});

		it('throws without a crypto key and does not cache the failure', async () => {
			mock_config_service.get.mockReturnValue(undefined);
			await expect(service.getSeed('user-1')).rejects.toThrow('No crypto key available');
			mock_config_service.get.mockImplementation((key: string) => (key === 'server.crypto_key' ? test_crypto_key : undefined));
			mock_seed_repository.findOne.mockResolvedValue(null);
			await expect(service.getSeed('user-1')).resolves.toBeInstanceOf(Uint8Array);
		});
	});

	describe('getBalances', () => {
		it("sums the user's ready proofs as numbers", async () => {
			mock_query_builder.getRawMany.mockResolvedValue([{unit: 'sat', keyset_id: '00abc', balance: '42'}]);
			const balances = await service.getBalances('user-1');
			expect(mock_query_builder.where).toHaveBeenCalledWith('proof.user_id = :user_id', {user_id: 'user-1'});
			expect(mock_query_builder.andWhere).toHaveBeenCalledWith('proof.state = :state', {state: WalletProofState.READY});
			expect(balances).toEqual([{unit: 'sat', keyset_id: '00abc', balance: 42}]);
		});
	});
});
