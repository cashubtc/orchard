/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {LightningWalletKitService} from '#server/modules/lightning/walletkit/lnwalletkit.service';
import type {LightningChannel} from '#server/modules/lightning/lightning/lightning.types';
import type {LightningAddresses} from '#server/modules/lightning/walletkit/lnwalletkit.types';
import {MintReserveSource, MintReserveStatus} from '#server/modules/cashu/cashu.enums';
import {isBitcoinUnit} from '#server/modules/cashu/cashu.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintReserves, OrchardMintReserveLiability, OrchardMintReserveSource} from './mintreserve.model.js';

/** One backend read; the value is set only when it succeeded */
type MintReserveReading<T> = {
	status: MintReserveStatus;
	value: T | null;
	error_code: OrchardErrorCode | null;
	error_details: string | null;
};

@Injectable()
export class MintReserveService {
	private readonly logger = new Logger(MintReserveService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private cashuMintRpcService: CashuMintRpcService,
		private lightningService: LightningService,
		private lightningWalletKitService: LightningWalletKitService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	/** Bitcoin liabilities and every reserve source; a source that can't be read never fails the others */
	async getMintReserves(tag: string): Promise<OrchardMintReserves> {
		const [liabilities, channels, lightning_wallet, mint_wallet] = await Promise.all([
			this.getLiabilities(tag),
			this.readSource(
				tag,
				OrchardErrorCode.LightningRpcActionError,
				this.lightningService.isConfigured() ? () => this.lightningService.getChannels() : null,
			),
			this.readSource(
				tag,
				OrchardErrorCode.LightningRpcActionError,
				this.lightningWalletKitService.isConfigured() ? () => this.lightningWalletKitService.getLightningAddresses() : null,
			),
			this.readSource(
				tag,
				OrchardErrorCode.MintRpcActionError,
				this.cashuMintRpcService.isConfigured() ? () => this.cashuMintRpcService.getMintWalletBalance() : null,
			),
		]);

		return new OrchardMintReserves(liabilities, [
			new OrchardMintReserveSource(
				MintReserveSource.LIGHTNING_ACTIVE,
				channels,
				channels.value && this.sumChannelOutbound(channels.value, true),
			),
			new OrchardMintReserveSource(
				MintReserveSource.LIGHTNING_INACTIVE,
				channels,
				channels.value && this.sumChannelOutbound(channels.value, false),
			),
			new OrchardMintReserveSource(
				MintReserveSource.LIGHTNING_WALLET,
				lightning_wallet,
				lightning_wallet.value && this.sumWalletBalance(lightning_wallet.value),
			),
			new OrchardMintReserveSource(
				MintReserveSource.MINT_WALLET,
				mint_wallet,
				mint_wallet.value && parseFloat(mint_wallet.value.trusted_spendable_sat),
			),
		]);
	}

	/** Unspent ecash per bitcoin unit; without liabilities there is nothing to cover, so this fails the query */
	private async getLiabilities(tag: string): Promise<OrchardMintReserveLiability[]> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const balances = await this.cashuMintDatabaseService.getBalances(client);
				const totals = new Map<string, number>();
				for (const {unit, balance} of balances) {
					if (!isBitcoinUnit(unit)) continue;
					const key = unit.toLowerCase();
					totals.set(key, (totals.get(key) ?? 0) + Number(balance));
				}
				return [...totals].map(([unit, amount]) => new OrchardMintReserveLiability(unit, amount));
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	/** Reads one backend, turning any failure into a status the client can show; a null read means it isn't configured */
	private async readSource<T>(tag: string, errord: OrchardErrorCode, read: (() => Promise<T>) | null): Promise<MintReserveReading<T>> {
		if (!read) return {status: MintReserveStatus.UNCONFIGURED, value: null, error_code: null, error_details: null};
		try {
			return {status: MintReserveStatus.AVAILABLE, value: await read(), error_code: null, error_details: null};
		} catch (error) {
			const {code, details} = this.errorService.resolveError(this.logger, error, tag, {errord});
			const unsupported = code === OrchardErrorCode.MintSupportError || code === OrchardErrorCode.LightningSupportError;
			if (!unsupported) this.logger.warn(`${tag}: ${details ?? code}`);
			return {
				status: unsupported ? MintReserveStatus.UNSUPPORTED : MintReserveStatus.UNAVAILABLE,
				value: null,
				error_code: code,
				error_details: details ?? null,
			};
		}
	}

	/** Local balance of the bitcoin channels that are, or aren't, active; asset channels back no bitcoin */
	private sumChannelOutbound(channels: LightningChannel[], active: boolean): number {
		return channels
			.filter((channel) => channel.asset === null && channel.active === active)
			.reduce((sum, channel) => sum + parseFloat(channel.local_balance), 0);
	}

	/** On-chain balance of every wallet address, as the bitcoin hot wallet shows it */
	private sumWalletBalance(addresses: LightningAddresses): number {
		return addresses.account_with_addresses
			.flatMap((account) => account.addresses)
			.reduce((sum, address) => sum + Number(address.balance), 0);
	}
}
