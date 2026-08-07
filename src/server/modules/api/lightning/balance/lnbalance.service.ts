/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {LightningChannel, LightningChannelBalance} from '#server/modules/lightning/lightning/lightning.types';
/* Local Dependencies */
import {OrchardLightningBalance, OrchardLightningChannelSummary, OrchardLightningAssetBalance} from './lnbalance.model.js';

@Injectable()
export class LightningBalanceService {
	private readonly logger = new Logger(LightningBalanceService.name);

	constructor(
		private lightningService: LightningService,
		private errorService: ErrorService,
	) {}

	/** Fetches channel and balance data, then computes aggregated balance summaries */
	async getLightningChannelBalance(tag: string): Promise<OrchardLightningBalance> {
		try {
			const [channels, balance] = await Promise.all([
				this.lightningService.getChannels(),
				this.lightningService.getLightningChannelBalance(),
			]);
			return this.buildBalance(channels, balance);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.LightningRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Builds the balance response from channel data and balance RPC */
	private buildBalance(channels: LightningChannel[], balance: LightningChannelBalance): OrchardLightningBalance {
		const result = new OrchardLightningBalance();

		result.open = this.buildChannelSummary(channels);
		result.active = this.buildChannelSummary(channels.filter((c) => c.active));

		result.pending_open_balance = parseFloat(balance.pending_open_balance);
		result.unsettled_local_balance = parseFloat(balance.unsettled_local_balance);
		result.unsettled_remote_balance = parseFloat(balance.unsettled_remote_balance);
		result.pending_open_local_balance = parseFloat(balance.pending_open_local_balance);
		result.pending_open_remote_balance = parseFloat(balance.pending_open_remote_balance);

		return result;
	}

	/** Computes BTC and asset sums from a set of channels */
	private buildChannelSummary(channels: LightningChannel[]): OrchardLightningChannelSummary {
		const summary = new OrchardLightningChannelSummary();

		const btc_channels = channels.filter((c) => c.asset === null);
		summary.capacity = btc_channels.reduce((sum, c) => sum + parseFloat(c.capacity), 0);
		summary.local_balance = btc_channels.reduce((sum, c) => sum + parseFloat(c.local_balance), 0);
		summary.remote_balance = btc_channels.reduce((sum, c) => sum + parseFloat(c.remote_balance), 0);
		summary.assets = this.aggregateAssets(channels);

		return summary;
	}

	/** Aggregates asset channel data grouped by group_key (falls back to asset_id) */
	private aggregateAssets(channels: LightningChannel[]): OrchardLightningAssetBalance[] {
		const asset_channels = channels.filter((c) => c.asset !== null);
		const asset_map = new Map<string, OrchardLightningAssetBalance>();

		asset_channels.forEach((channel) => {
			const asset = channel.asset!;
			const key = asset.group_key || asset.asset_id;
			const existing = asset_map.get(key);
			if (existing) {
				existing.capacity += parseFloat(asset.capacity);
				existing.local_balance += parseFloat(asset.local_balance);
				existing.remote_balance += parseFloat(asset.remote_balance);
			} else {
				const entry = new OrchardLightningAssetBalance();
				entry.group_key = asset.group_key;
				entry.asset_id = asset.asset_id;
				entry.name = asset.name;
				entry.capacity = parseFloat(asset.capacity);
				entry.local_balance = parseFloat(asset.local_balance);
				entry.remote_balance = parseFloat(asset.remote_balance);
				entry.decimal_display = asset.decimal_display;
				asset_map.set(key, entry);
			}
		});

		return Array.from(asset_map.values());
	}
}
