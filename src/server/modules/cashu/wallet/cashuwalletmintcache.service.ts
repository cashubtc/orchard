/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	JSONInt,
	KeyChain,
	type GetInfoResponse,
	type KeyChainCache,
	type Keys,
	type Mint,
	type MintInfo,
	type Wallet,
} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletMintInfo} from './cashuwalletmintinfo.entity.js';
import {CashuWalletMintKeyset} from './cashuwalletmintkeyset.entity.js';

const KEYSETS_TTL_S = 60 * 60;

@Injectable()
export class CashuWalletMintCacheService {
	constructor(
		@InjectRepository(CashuWalletMintInfo)
		private mintInfoRepository: Repository<CashuWalletMintInfo>,
		@InjectRepository(CashuWalletMintKeyset)
		private mintKeysetRepository: Repository<CashuWalletMintKeyset>,
	) {}

	/* *******************************************************
		Info
	******************************************************** */

	/** Cached info for mint URLs, keyed by URL */
	public async getInfos(mint_urls: string[]): Promise<Map<string, CashuWalletMintInfo>> {
		const rows = mint_urls.length > 0 ? await this.mintInfoRepository.findBy({mint_url: In(mint_urls)}) : [];
		return new Map(rows.map((row) => [row.mint_url, row]));
	}

	/** Save a fresh /v1/info under the URL it came from */
	public async saveInfo(mint_url: string, info: MintInfo): Promise<void> {
		await this.mintInfoRepository.upsert(
			{
				mint_url,
				pubkey: info.pubkey || null,
				name: info.name || null,
				info: JSONInt.stringify(info.cache),
				info_updated_at: DateTime.now().toUnixInteger(),
			},
			['mint_url'],
		);
	}

	/* *******************************************************
		Keysets
	******************************************************** */

	/** Refresh a URL's keysets once they are an hour old: cashu-ts refetches /v1/keysets and /v1/keys and keeps cached keys */
	public async refreshKeysets(mint: Mint): Promise<void> {
		const info = await this.mintInfoRepository.findOneBy({mint_url: mint.mintUrl});
		if (!info || (info.keysets_updated_at ?? 0) > DateTime.now().toUnixInteger() - KEYSETS_TTL_S) return;
		const chain = KeyChain.fromCache(mint, '', (await this.getKeychain(mint.mintUrl)) ?? {mintUrl: mint.mintUrl, keysets: []});
		await chain.init(true);
		await this.saveKeychain(chain.cache);
	}

	/** Save a cashu-ts keychain, keeping cached keys for ids it holds none for; its savedAt stamps the keyset refresh */
	public async saveKeychain({mintUrl: mint_url, keysets, savedAt}: KeyChainCache): Promise<void> {
		const now = DateTime.now().toUnixInteger();
		const cached_keys = new Map((await this.mintKeysetRepository.findBy({mint_url})).map((row) => [row.id, row.keys]));
		const rows = keysets.map((keyset) => ({
			mint_url,
			id: keyset.id,
			unit: keyset.unit,
			active: keyset.active,
			input_fee_ppk: keyset.input_fee_ppk ?? 0,
			final_expiry: keyset.final_expiry ?? null,
			keys: keyset.keys ? JSON.stringify(keyset.keys) : (cached_keys.get(keyset.id) ?? null),
			updated_at: now,
		}));
		if (rows.length > 0) await this.mintKeysetRepository.upsert(rows, ['mint_url', 'id']);
		const refreshed_at = savedAt ? DateTime.fromMillis(savedAt).toUnixInteger() : now;
		await this.mintInfoRepository.update({mint_url}, {keysets_updated_at: refreshed_at});
	}

	/** Save what a wallet loaded from the network: its info and keychain */
	public async saveWallet(wallet: Wallet): Promise<void> {
		await this.saveInfo(wallet.mint.mintUrl, wallet.getMintInfo());
		await this.saveKeychain(wallet.keyChain.cache);
	}

	/* *******************************************************
		Wallet
	******************************************************** */

	/** Cached info and keychain for building a wallet without network calls, or null until both are cached */
	public async getWalletCache(mint_url: string): Promise<{info: GetInfoResponse; keychain: KeyChainCache} | null> {
		const [info, keychain] = await Promise.all([this.mintInfoRepository.findOneBy({mint_url}), this.getKeychain(mint_url)]);
		if (!info || !keychain) return null;
		return {info: JSONInt.parse(info.info) as GetInfoResponse, keychain};
	}

	/** A URL's cached keysets as a cashu-ts keychain cache, or null before its keysets were first saved */
	private async getKeychain(mint_url: string): Promise<KeyChainCache | null> {
		const [info, keysets] = await Promise.all([
			this.mintInfoRepository.findOneBy({mint_url}),
			this.mintKeysetRepository.findBy({mint_url}),
		]);
		if (!info?.keysets_updated_at || keysets.length === 0) return null;
		return {
			mintUrl: mint_url,
			savedAt: info.keysets_updated_at * 1000,
			keysets: keysets.map((row) => ({
				id: row.id,
				unit: row.unit,
				active: row.active,
				input_fee_ppk: row.input_fee_ppk,
				final_expiry: row.final_expiry ?? undefined,
				keys: row.keys ? (JSON.parse(row.keys) as Keys) : undefined,
			})),
		};
	}
}
