/* Core Dependencies */
import {BadRequestException, Injectable, Logger, type OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Application Dependencies */
import {MintMetricsService} from '#server/modules/cashu/mintmetrics/mintmetrics.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {isSettingSensitive} from '#server/modules/setting/setting.helpers';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {LightningWalletKitService} from '#server/modules/lightning/walletkit/lnwalletkit.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {MintDatabaseType} from '#server/modules/cashu/mintdb/cashumintdb.enums';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {BitcoinAnalyticsService} from '#server/modules/bitcoin/analytics/btcanalytics.service';
import {LightningAnalyticsService} from '#server/modules/lightning/analytics/lnanalytics.service';
import {CashuMintAnalyticsService} from '#server/modules/cashu/mintanalytics/mintanalytics.service';

/* Native Dependencies */
import {ServiceTestService} from '#server/modules/service-config/service-test.service';
import {
	SERVICE_NAMES,
	SERVICE_DEFINITIONS,
	DATABASE_RECHECK_MS,
	SERVICE_SETTING_KEYS,
} from '#server/modules/service-config/constants/service-config.constants';
import {applyServiceSettings, normalizeConnectionValue} from '#server/modules/service-config/helpers/service-config.helpers';
import type {
	ConnectionInput,
	ConnectionValues,
	ConnectionCheck,
	IntegrationConfig,
	ServiceConfiguration,
	ServiceName,
	ServiceState,
	ServiceStatus,
} from '#server/modules/service-config/types/service-config.types';

@Injectable()
export class ServiceConfigService implements OnApplicationBootstrap {
	private readonly logger = new Logger(ServiceConfigService.name);
	private mutation_queue: Promise<unknown> = Promise.resolve();
	private database_check: Promise<boolean> = Promise.resolve(false);
	private database_checked_at = 0;
	private statuses = new Map<ServiceName, ServiceStatus>();

	constructor(
		private configService: ConfigService,
		private settingService: SettingService,
		private testService: ServiceTestService,
		private bitcoinRpcService: BitcoinRpcService,
		private lightningService: LightningService,
		private walletKitService: LightningWalletKitService,
		private clnService: ClnService,
		private mintRpcService: CashuMintRpcService,
		private mintDatabaseService: CashuMintDatabaseService,
		private cdkRpcService: CdkRpcService,
		private bitcoinAnalyticsService: BitcoinAnalyticsService,
		private lightningAnalyticsService: LightningAnalyticsService,
		private mintAnalyticsService: CashuMintAnalyticsService,
		private mintMetricsService: MintMetricsService,
	) {}

	/** Check the mint database once at boot instead of on every status read. */
	public onApplicationBootstrap(): void {
		if (process.env.SCHEMA_ONLY) return;
		this.checkDatabase();
	}

	/* *******************************************************
        Configuration
    ******************************************************** */

	/** Nonsecret runtime flags are available to authenticated users for navigation. */
	public async getStatus(): Promise<ServiceState[]> {
		const settings = new Map(
			(await this.settingService.getSettings([...SERVICE_SETTING_KEYS])).map((setting) => [setting.key, setting.value]),
		);
		const database = await this.databaseAvailable();
		return SERVICE_NAMES.map((service) => {
			const definition = SERVICE_DEFINITIONS[service];
			const config = this.configService.get<IntegrationConfig>(definition.group) ?? {};
			const enabled = !!config.type;
			return {
				service,
				enabled,
				type: String(config.type || '') || null,
				source: !enabled ? 'none' : settings.get(definition.enabled_key) ? 'orchard' : 'environment',
				status: enabled ? (this.statuses.get(service) ?? 'not_tested') : 'not_configured',
				database: service === 'mint' && database,
				public_api: !!config.api,
				database_type: String(config.database_type ?? MintDatabaseType.sqlite),
				metrics: service === 'mint' && this.mintMetricsService.isEnabled(),
			};
		});
	}

	/** Return editable nonsecret values and presence flags; never return pasted credentials. */
	public async getConfigurations(): Promise<ServiceConfiguration[]> {
		return (await this.getStatus()).map((state) => {
			const config = this.configService.get<IntegrationConfig>(SERVICE_DEFINITIONS[state.service].group) ?? {};
			return {
				...state,
				fields: SERVICE_DEFINITIONS[state.service].fields.map((field) => {
					const value = state.enabled ? String(config[field.config] ?? '') : '';
					const secret = isSettingSensitive(field.key, value);
					return {key: field.name, value: secret ? null : value, secret, set: !!value};
				}),
			};
		});
	}

	/** Test the form, resolving omitted secret fields against the effective configuration. */
	public test(input: ConnectionInput): Promise<ConnectionCheck> {
		return this.testService.test(input.service, this.resolveValues(input));
	}

	/** Serialize saves/removals so an older test cannot overwrite a newer configuration. */
	public save(input: ConnectionInput, save_unreachable: boolean): Promise<ConnectionCheck> {
		return this.serialize(async () => {
			const values = this.resolveValues(input);
			const result = await this.testService.test(input.service, values);
			// Saving without a working connection accepts an unreachable node, never missing or malformed credentials
			if (!result.ok && (!save_unreachable || !this.testService.isValid(input.service, values))) return result;
			await this.apply(input.service, values, true);
			this.statuses.set(input.service, !result.ok ? 'unreachable' : result.warning ? 'warning' : 'connected');
			return {...result, saved: true};
		});
	}

	/** Store a durable disabled override while preserving collected analytics. */
	public remove(service: ServiceName): Promise<boolean> {
		return this.serialize(async () => {
			await this.apply(service, {}, false);
			this.statuses.delete(service);
			return true;
		});
	}

	/** Build a complete snapshot so blank optional fields also override the environment. */
	private resolveValues(input: ConnectionInput): ConnectionValues {
		const definition = SERVICE_DEFINITIONS[input.service];
		const allowed = new Set(definition.fields.map((field) => field.name as string));
		if (input.values.some((field) => !allowed.has(field.key))) throw new BadRequestException('Unknown service field');
		if (new Set(input.values.map((field) => field.key)).size !== input.values.length)
			throw new BadRequestException('Duplicate service field');
		const config = this.configService.get<IntegrationConfig>(definition.group) ?? {};
		const values: ConnectionValues = {};
		for (const field of definition.fields)
			values[field.name] = normalizeConnectionValue(
				field.name,
				input.values.find((entry) => entry.key === field.name)?.value ?? String(config[field.config] ?? ''),
			);
		if (!definition.types.includes(values.type ?? '')) throw new BadRequestException('Unsupported service type');
		if (values.api) {
			try {
				const url = new URL(values.api);
				if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
			} catch {
				throw new BadRequestException('Public mint URL must be an HTTP or HTTPS URL without credentials');
			}
		}
		if (values.host?.includes('@')) throw new BadRequestException('RPC host must not contain credentials');
		return values;
	}

	/** Stop dependent analytics, persist, merge settings, and replace the selected group's connections. */
	private async apply(service: ServiceName, values: ConnectionValues, enabled: boolean): Promise<void> {
		// Bitcoin analytics reads its node identity from Lightning, so both restart with a Lightning change.
		const analytics: Pick<CashuMintAnalyticsService, 'pause' | 'reinitialize'>[] =
			service === 'mint'
				? [this.mintAnalyticsService]
				: service === 'lightning'
					? [this.bitcoinAnalyticsService, this.lightningAnalyticsService]
					: [];
		await Promise.all(analytics.map((instance) => instance.pause()));
		try {
			const definition = SERVICE_DEFINITIONS[service];
			const settings = await this.settingService.updateSettings(
				[definition.enabled_key, ...definition.fields.map((field) => field.key)],
				[String(enabled), ...definition.fields.map((field) => values[field.name] ?? '')],
			);
			applyServiceSettings(this.configService, settings, [service]);
			// The chain is read in the background, so an unreachable node can't hold the save past a proxy's timeout
			if (service === 'bitcoin') void this.bitcoinRpcService.reinitialize();
			if (service === 'lightning') {
				this.clnService.reinitialize();
				this.lightningService.reinitialize();
				this.walletKitService.reinitialize();
			}
			if (service === 'mint') {
				this.cdkRpcService.reinitialize();
				this.mintRpcService.reinitialize();
				this.mintDatabaseService.reinitialize();
				this.mintMetricsService.reinitialize();
				this.checkDatabase();
			}
		} finally {
			for (const instance of analytics) instance.reinitialize();
		}
	}

	/** Probe the mint database in the background; status reads wait for the latest probe. */
	private checkDatabase(): void {
		this.database_checked_at = Date.now();
		this.database_check = this.configService.get<string>('cashu.database')
			? this.testService.testDatabase(this.configService).then(
					() => true,
					(error: unknown) => {
						this.logger.warn(`Mint database unavailable: ${error instanceof Error ? error.message : String(error)}`);
						return false;
					},
				)
			: Promise.resolve(false);
	}

	/** Retry an unavailable database, so one created or started after Orchard unlocks its pages without a restart. */
	private async databaseAvailable(): Promise<boolean> {
		const available = await this.database_check;
		if (available || Date.now() - this.database_checked_at < DATABASE_RECHECK_MS) return available;
		this.checkDatabase();
		return this.database_check;
	}

	/** Keep mutations ordered even after a failed operation. */
	private serialize<T>(action: () => Promise<T>): Promise<T> {
		const pending = this.mutation_queue.then(action);
		this.mutation_queue = pending.catch(() => undefined);
		return pending;
	}
}
