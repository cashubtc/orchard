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
import {walletError} from '../cashuwallet.helpers.js';
import type {CashuWalletSeedStatus} from '../cashuwallet.types.js';

@Injectable()
export class CashuWalletSeedService {
	private readonly logger = new Logger(CashuWalletSeedService.name);
	private seeds = new Map<string, Promise<Uint8Array>>();

	constructor(
		@InjectRepository(CashuWalletSeed)
		private walletSeedRepository: Repository<CashuWalletSeed>,
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

	/** A user's mnemonic for backup, creating the wallet seed on first use */
	public async getMnemonic(user_id: string): Promise<string> {
		await this.getSeed(user_id);
		const stored = await this.walletSeedRepository.findOneByOrFail({user_id});
		return this.decryptMnemonic(stored.mnemonic, this.getEncryptionKey());
	}

	/** A user's seed backup status, or null before the wallet is first used */
	public async getSeedStatus(user_id: string): Promise<CashuWalletSeedStatus | null> {
		return this.walletSeedRepository.findOne({where: {user_id}, select: ['created_at', 'backed_up_at']});
	}

	/** Record that a user has written down their mnemonic; refused before a seed exists */
	public async markBackedUp(user_id: string): Promise<CashuWalletSeedStatus> {
		const result = await this.walletSeedRepository.update({user_id}, {backed_up_at: DateTime.now().toUnixInteger()});
		if (!result.affected) throw walletError('This wallet has no seed yet; reveal the mnemonic before confirming a backup');
		return (await this.getSeedStatus(user_id))!;
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
			backed_up_at: null,
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
}
