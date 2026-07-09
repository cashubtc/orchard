/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Cron} from '@nestjs/schedule';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AuthService} from '@server/modules/auth/auth.service';
import {SettingService} from '@server/modules/setting/setting.service';
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {BitcoinUTXOracleService} from '@server/modules/bitcoin/utxoracle/utxoracle.service';
import {LightningAnalyticsService} from '@server/modules/lightning/analytics/lnanalytics.service';
import {BitcoinAnalyticsService} from '@server/modules/bitcoin/analytics/btcanalytics.service';
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {AgentService} from '@server/modules/ai/agent/agent.service';
import {ConversationService} from '@server/modules/ai/conversation/conversation.service';
import {SystemMetricsService} from '@server/modules/system/metrics/sysmetrics.service';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
import {BitcoinType} from '@server/modules/bitcoin/bitcoin.enums';
import {MintType} from '@server/modules/cashu/cashu.enums';
import {SettingKey} from '@server/modules/setting/setting.enums';

@Injectable()
export class TaskService {
	private readonly logger = new Logger(TaskService.name);

	constructor(
		private authService: AuthService,
		private settingService: SettingService,
		private bitcoinRpcService: BitcoinRpcService,
		private bitcoinUTXOracleService: BitcoinUTXOracleService,
		private lightningAnalyticsService: LightningAnalyticsService,
		private bitcoinAnalyticsService: BitcoinAnalyticsService,
		private cashuMintAnalyticsService: CashuMintAnalyticsService,
		private configService: ConfigService,
		private agentService: AgentService,
		private conversationService: ConversationService,
		private systemMetricsService: SystemMetricsService,
		private mintMetricsService: MintMetricsService,
	) {}

	/**
	 * Clean up expired tokens from blacklist daily at 3 AM
	 */
	@Cron('0 3 * * *', {
		name: 'cleanup-expired-tokens',
		timeZone: 'UTC',
	})
	async cleanupExpiredTokens() {
		this.logger.log('Starting expired token cleanup...');
		try {
			const count = await this.authService.cleanupExpiredTokens();
			this.logger.log(`Cleaned up ${count} expired tokens`);
		} catch (error) {
			this.logger.error(`Error cleaning up tokens: ${error.message}`);
		}
	}

	/**
	 * Run Bitcoin oracle for previous day and save price at 1 AM UTC
	 */
	@Cron('0 1 * * *', {
		name: 'daily-bitcoin-oracle',
		timeZone: 'UTC',
	})
	async runDailyBitcoinOracle() {
		const bitcoin_type = this.configService.get<BitcoinType>('bitcoin.type');
		if (!bitcoin_type) {
			this.logger.debug('Bitcoin not configured, skipping oracle job');
			return;
		}

		const bitcoin_oracle_enabled = await this.settingService.getBooleanSetting(SettingKey.BITCOIN_ORACLE);
		if (!bitcoin_oracle_enabled) {
			this.logger.debug('Bitcoin oracle is not enabled, skipping oracle job');
			return;
		}

		try {
			const blockchain_info = await this.bitcoinRpcService.getBitcoinBlockchainInfo();
			if (blockchain_info.chain !== 'main') {
				this.logger.debug(`Bitcoin chain is ${blockchain_info.chain}, oracle only runs on mainnet. Skipping job.`);
				return;
			}
		} catch (error) {
			this.logger.error(`Failed to check Bitcoin chain: ${error.message}`);
			return;
		}

		this.logger.log('Starting daily Bitcoin oracle job...');
		try {
			const yesterday = DateTime.utc().minus({days: 1}).startOf('day');
			const date_timestamp = Math.floor(yesterday.toSeconds());
			const date_str = yesterday.toFormat('yyyy-MM-dd');
			this.logger.log(`Running oracle for date: ${date_str} (timestamp: ${date_timestamp})`);
			const result = await this.bitcoinUTXOracleService.runOracle({
				date: date_timestamp,
				intraday: false,
			});
			await this.bitcoinUTXOracleService.saveOraclePrice(date_timestamp, result.central_price);
			this.logger.log(`Oracle job completed for ${date_str}: price=${result.central_price}`);
		} catch (error) {
			this.logger.error(`Error running daily oracle: ${error.message}`, error.stack);
		}
	}

	/**
	 * Update lightning analytics at 5 minutes past each hour
	 * Uses streaming backfill which is checkpoint-based and works with both LND and CLN
	 */
	@Cron('5 * * * *', {
		name: 'hourly-lightning-analytics',
		timeZone: 'UTC',
	})
	async runHourlyLightningAnalytics() {
		const lightning_type = this.configService.get<string>('lightning.type');
		if (!lightning_type) {
			this.logger.debug('Lightning not configured, skipping analytics job');
			return;
		}

		this.logger.log('Starting lightning analytics update...');
		try {
			await this.lightningAnalyticsService.runStreamingBackfill();
			this.logger.log('Lightning analytics update complete');
		} catch (error) {
			this.logger.error(`Error updating lightning analytics: ${error.message}`, error.stack);
		}
	}

	/**
	 * Daily rescan of recent lightning records to catch pending invoices/payments that settled
	 * Runs at 3:15am UTC
	 */
	@Cron('15 3 * * *', {
		name: 'daily-lightning-analytics-rescan',
		timeZone: 'UTC',
	})
	async runDailyLightningAnalyticsRescan() {
		const lightning_type = this.configService.get<string>('lightning.type');
		if (!lightning_type) {
			this.logger.debug('Lightning not configured, skipping analytics rescan');
			return;
		}

		this.logger.log('Starting daily lightning analytics rescan...');
		try {
			await this.lightningAnalyticsService.rescanRecentRecords();
			this.logger.log('Daily lightning analytics rescan complete');
		} catch (error) {
			this.logger.error(`Error during lightning analytics rescan: ${error.message}`, error.stack);
		}
	}

	/**
	 * Update cashu mint analytics at 5 minutes past each hour
	 * Uses streaming backfill which is checkpoint-based
	 */
	@Cron('5 * * * *', {
		name: 'hourly-cashu-mint-analytics',
		timeZone: 'UTC',
	})
	async runHourlyCashuMintAnalytics() {
		const cashu_type = this.configService.get<string>('cashu.type');
		if (!cashu_type) {
			this.logger.debug('Cashu not configured, skipping mint analytics job');
			return;
		}

		this.logger.log('Starting cashu mint analytics update...');
		try {
			await this.cashuMintAnalyticsService.runBackfill();
			this.logger.log('Cashu mint analytics update complete');
		} catch (error) {
			this.logger.error(`Error updating cashu mint analytics: ${error.message}`, error.stack);
		}
	}

	/**
	 * Daily rescan of recent cashu mint records to catch state changes (UNPAID → PAID → ISSUED)
	 * Runs at 3:30am UTC
	 */
	@Cron('30 3 * * *', {
		name: 'daily-cashu-mint-analytics-rescan',
		timeZone: 'UTC',
	})
	async runDailyCashuMintAnalyticsRescan() {
		const cashu_type = this.configService.get<string>('cashu.type');
		if (!cashu_type) {
			this.logger.debug('Cashu not configured, skipping mint analytics rescan');
			return;
		}

		this.logger.log('Starting daily cashu mint analytics rescan...');
		try {
			await this.cashuMintAnalyticsService.rescanRecentRecords();
			this.logger.log('Daily cashu mint analytics rescan complete');
		} catch (error) {
			this.logger.error(`Error during cashu mint analytics rescan: ${error.message}`, error.stack);
		}
	}

	/**
	 * Update bitcoin on-chain analytics at 10 minutes past each hour
	 * Tracks BTC wallet transactions and taproot asset transfers
	 */
	@Cron('10 * * * *', {
		name: 'hourly-bitcoin-analytics',
		timeZone: 'UTC',
	})
	async runHourlyBitcoinAnalytics() {
		const lightning_type = this.configService.get<string>('lightning.type');
		if (!lightning_type) {
			this.logger.debug('Lightning not configured, skipping bitcoin analytics job');
			return;
		}

		this.logger.log('Starting bitcoin analytics update...');
		try {
			await this.bitcoinAnalyticsService.runStreamingBackfill();
			this.logger.log('Bitcoin analytics update complete');
		} catch (error) {
			this.logger.error(`Error updating bitcoin analytics: ${error.message}`, error.stack);
		}
	}

	/**
	 * Daily rescan of recent bitcoin on-chain records to catch late confirmations
	 * Runs at 3:45am UTC
	 */
	@Cron('45 3 * * *', {
		name: 'daily-bitcoin-analytics-rescan',
		timeZone: 'UTC',
	})
	async runDailyBitcoinAnalyticsRescan() {
		const lightning_type = this.configService.get<string>('lightning.type');
		if (!lightning_type) {
			this.logger.debug('Lightning not configured, skipping bitcoin analytics rescan');
			return;
		}

		this.logger.log('Starting daily bitcoin analytics rescan...');
		try {
			await this.bitcoinAnalyticsService.rescanRecentRecords();
			this.logger.log('Daily bitcoin analytics rescan complete');
		} catch (error) {
			this.logger.error(`Error during bitcoin analytics rescan: ${error.message}`, error.stack);
		}
	}

	/**
	 * Clean up old agent runs, keeping the last 100 per agent
	 * Runs daily at 4 AM UTC
	 */
	@Cron('0 4 * * *', {
		name: 'cleanup-agent-runs',
		timeZone: 'UTC',
	})
	async cleanupAgentRuns() {
		this.logger.log('Starting agent run cleanup...');
		try {
			await this.agentService.cleanupOldRuns();
			this.logger.log('Agent run cleanup complete');
		} catch (error) {
			this.logger.error(`Error cleaning up agent runs: ${error.message}`);
		}
	}

	/**
	 * Collect system metrics every minute
	 * Guarded by SYSTEM_METRICS setting
	 */
	@Cron('* * * * *', {
		name: 'collect-system-metrics',
		timeZone: 'UTC',
	})
	async collectSystemMetrics() {
		if (!(await this.settingService.getBooleanSetting(SettingKey.SYSTEM_METRICS))) return;

		try {
			await this.systemMetricsService.collectAndStore();
		} catch (error) {
			this.logger.error(`Error collecting system metrics: ${error.message}`);
		}
	}

	/**
	 * Clean up old system metrics and downsample daily at 2:30 AM UTC
	 * Guarded by SYSTEM_METRICS setting
	 */
	@Cron('30 2 * * *', {
		name: 'cleanup-system-metrics',
		timeZone: 'UTC',
	})
	async cleanupSystemMetrics() {
		if (!(await this.settingService.getBooleanSetting(SettingKey.SYSTEM_METRICS))) return;

		this.logger.log('Starting system metrics cleanup...');
		try {
			await this.systemMetricsService.cleanupOldMetrics();
			this.logger.log('System metrics cleanup complete');
		} catch (error) {
			this.logger.error(`Error cleaning up system metrics: ${error.message}`, error.stack);
		}
	}


	/**
	 * Collect mint prometheus metrics every minute
	 * Runs only for cdk mints with a configured metrics endpoint
	 */
	@Cron('* * * * *', {
		name: 'collect-mint-metrics',
		timeZone: 'UTC',
	})
	async collectMintMetrics() {
		if (this.configService.get('cashu.type') !== MintType.CDK) return;
        const mint_metrics_enabled = await this.settingService.getStringSetting(SettingKey.MINT_METRICS_API);
		if (!mint_metrics_enabled) return;

		try {
			await this.mintMetricsService.collectAndStore();
		} catch (error) {
			this.logger.error(`Error collecting mint metrics: ${error.message}`);
		}
	}

	/**
	 * Clean up old mint metrics and downsample daily at 2:45 AM UTC
	 * Runs only for cdk mints with a configured metrics endpoint
	 */
	@Cron('45 2 * * *', {
		name: 'cleanup-mint-metrics',
		timeZone: 'UTC',
	})
	async cleanupMintMetrics() {
		if (this.configService.get('cashu.type') !== MintType.CDK) return;
		const mint_metrics_enabled = await this.settingService.getStringSetting(SettingKey.MINT_METRICS_API);
		if (!mint_metrics_enabled) return;

		this.logger.log('Starting mint metrics cleanup...');
		try {
			await this.mintMetricsService.cleanupOldMetrics();
			this.logger.log('Mint metrics cleanup complete');
		} catch (error) {
			this.logger.error(`Error cleaning up mint metrics: ${error.message}`, error.stack);
		}
	}

	/**
	 * Expire stale conversations daily at 4:30 AM UTC
	 */
	@Cron('30 4 * * *', {
		name: 'cleanup-expired-conversations',
		timeZone: 'UTC',
	})
	async cleanupExpiredConversations() {
		this.logger.log('Starting expired conversation cleanup...');
		try {
			await this.conversationService.cleanupExpiredConversations();
			this.logger.log('Expired conversation cleanup complete');
		} catch (error) {
			this.logger.error(`Error cleaning up expired conversations: ${error.message}`);
		}
	}
}
