/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {mnemonicToSeedSync} from '@cashu/cashu-ts';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
/* Application Dependencies */
import {deriveEncryptionKeyFromHex, encryptValue, decryptValue} from '#server/modules/setting/setting.helpers';
/* Local Dependencies */
import {CashuWalletSeed} from './cashuwalletseed.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {WalletProofState} from './cashuwallet.enums.js';
import type {CashuWalletBalance} from './cashuwallet.types.js';

@Injectable()
export class CashuWalletService {
	private readonly logger = new Logger(CashuWalletService.name);
	private seeds = new Map<string, Promise<Uint8Array>>();

	constructor(
		@InjectRepository(CashuWalletSeed)
		private walletSeedRepository: Repository<CashuWalletSeed>,
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
		private configService: ConfigService,
	) {}

	/* *******************************************************
		Seed
	******************************************************** */

	/** Get a user's BIP-39 seed, creating and persisting a new mnemonic on first use */
	public getSeed(user_id: string): Promise<Uint8Array> {
		const cached = this.seeds.get(user_id);
		if (cached) return cached;
		const seed = this.loadOrCreateSeed(user_id).catch((error) => {
			this.seeds.delete(user_id);
			throw error;
		});
		this.seeds.set(user_id, seed);
		return seed;
	}

	/** Load a user's stored mnemonic, or generate and store a new one */
	private async loadOrCreateSeed(user_id: string): Promise<Uint8Array> {
		const encryption_key = this.getEncryptionKey();
		const existing = await this.walletSeedRepository.findOne({where: {user_id}});
		if (existing) return mnemonicToSeedSync(this.decryptMnemonic(existing.mnemonic, encryption_key));

		const mnemonic = generateMnemonic(wordlist, 128);
		await this.walletSeedRepository.insert({
			user_id,
			mnemonic: encryptValue(mnemonic, encryption_key),
			created_at: DateTime.now().toUnixInteger(),
		});
		this.logger.log(`Created a new ecash wallet seed for user ${user_id}`);
		return mnemonicToSeedSync(mnemonic);
	}

	/** Derive the seed encryption key from the crypto key */
	private getEncryptionKey(): Buffer {
		const crypto_key = this.configService.get<string>('server.crypto_key');
		if (!crypto_key) throw new Error('No crypto key available; the ecash wallet seed cannot be stored');
		return deriveEncryptionKeyFromHex(crypto_key);
	}

	/** Decrypt the stored mnemonic with an actionable error on key mismatch */
	private decryptMnemonic(stored_value: string, encryption_key: Buffer): string {
		try {
			return decryptValue(stored_value, encryption_key);
		} catch {
			throw new Error('Ecash wallet seed could not be decrypted; crypto.key or CRYPTO_KEY changed since the wallet was created');
		}
	}

	/* *******************************************************
		Balances
	******************************************************** */

	/** Sum a user's ready proofs by mint and unit */
	public async getBalances(user_id: string): Promise<CashuWalletBalance[]> {
		const rows = await this.walletProofRepository
			.createQueryBuilder('proof')
			.select('proof.mint_id', 'mint_id')
			.addSelect('proof.unit', 'unit')
			.addSelect('SUM(proof.amount)', 'balance')
			.where('proof.user_id = :user_id', {user_id})
			.andWhere('proof.state = :state', {state: WalletProofState.READY})
			.groupBy('proof.mint_id')
			.addGroupBy('proof.unit')
			.getRawMany<CashuWalletBalance>();
		return rows.map((row) => ({...row, balance: Number(row.balance)}));
	}
}
