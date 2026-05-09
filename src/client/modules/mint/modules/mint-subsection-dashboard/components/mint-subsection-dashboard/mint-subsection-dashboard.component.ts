/* Core Dependencies */
import {
	Component,
	ChangeDetectionStrategy,
	OnInit,
	ChangeDetectorRef,
	OnDestroy,
	ViewChild,
	ElementRef,
	ViewChildren,
	QueryList,
	signal,
	computed,
	WritableSignal,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {forkJoin, lastValueFrom, Subscription, EMPTY, catchError, finalize, tap} from 'rxjs';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {PublicService} from '@client/modules/public/services/image/public.service';
import {PublicImage} from '@client/modules/public/classes/public-image.class';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {NonNullableMintDashboardSettings} from '@client/modules/settings/types/setting.types';
import {PublicUrl} from '@client/modules/public/classes/public-url.class';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningBalance} from '@client/modules/lightning/classes/lightning-balance.class';
import {LightningAnalytic} from '@client/modules/lightning/classes/lightning-analytic.class';
import {AnalyticsBackfillStatus} from '@client/modules/analytics/classes/analytics-backfill-status.class';
import {getPreRangeEnd} from '@client/modules/analytics/helpers/analytics.helpers';
import {LightningAnalyticsArgs} from '@client/modules/lightning/types/lightning.types';
import {OrchardError} from '@client/modules/error/types/error.types';
import {NavTertiaryItem} from '@client/modules/nav/types/nav-tertiary-item.type';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintWatchdogStatus} from '@client/modules/mint/classes/mint-watchdog-status.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
import {MintDatabaseInfo} from '@client/modules/mint/classes/mint-database-info.class';
import {MintAnalytic} from '@client/modules/mint/classes/mint-analytic.class';
import {MintActivitySummary} from '@client/modules/mint/classes/mint-activity-summary.class';
import {ChartType} from '@client/modules/mint/enums/chart-type.enum';
/* Shared Dependencies */
import {AssistantToolName, AnalyticsInterval, MintActivityPeriod, MintUnit} from '@shared/generated.types';

enum NavSummary {
	Mint = 'summary1',
	BalanceSheet = 'summary2',
}

enum NavChart {
	BalanceSheet = 'nav1',
	Mints = 'nav2',
	Melts = 'nav3',
	Swaps = 'nav4',
	FeeRevenue = 'nav5',
	Ecash = 'nav6',
}

type NavSection = 'summary' | 'charts';

type ChartKey = 'balance_sheet' | 'mints' | 'melts' | 'swaps' | 'fee_revenue' | 'ecash';

@Component({
	selector: 'orc-mint-subsection-dashboard',
	standalone: false,
	templateUrl: './mint-subsection-dashboard.component.html',
	styleUrl: './mint-subsection-dashboard.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDashboardComponent implements OnInit, OnDestroy {
	@ViewChildren('summary1,summary2,nav1,nav2,nav3,nav4,nav5,nav6') nav_elements!: QueryList<ElementRef>;
	@ViewChild('summary_container', {static: false}) summary_container!: ElementRef;
	@ViewChild('chart_container', {static: false}) chart_container!: ElementRef;

	// data
	public mint_info: MintInfo | null = null;
	public mint_balances: MintBalance[] = [];
	public mint_keysets: MintKeyset[] = [];
	public mint_keyset_counts: MintKeysetCount[] = [];
	public mint_database_info: MintDatabaseInfo | null = null;
	public mint_watchdog_status: MintWatchdogStatus | null = null;
	public mint_analytics_balances: MintAnalytic[] = [];
	public mint_analytics_balances_pre: MintAnalytic[] = [];
	public mint_analytics_mints: MintAnalytic[] = [];
	public mint_analytics_mints_pre: MintAnalytic[] = [];
	public mint_analytics_melts: MintAnalytic[] = [];
	public mint_analytics_melts_pre: MintAnalytic[] = [];
	public mint_analytics_swaps: MintAnalytic[] = [];
	public mint_analytics_swaps_pre: MintAnalytic[] = [];
	public mint_analytics_fees: MintAnalytic[] = [];
	public mint_analytics_fees_pre: MintAnalytic[] = [];
	public mint_analytics_proofs: MintAnalytic[] = [];
	public mint_analytics_proofs_pre: MintAnalytic[] = [];
	public mint_analytics_promises: MintAnalytic[] = [];
	public mint_analytics_promises_pre: MintAnalytic[] = [];
	public mint_connections: PublicUrl[] = [];
	public lightning_enabled: boolean;
	public lightning_balance: LightningBalance | null = null;
	public lightning_analytics: LightningAnalytic[] = [];
	public lightning_analytics_pre: LightningAnalytic[] = [];
	public lightning_analytics_backfill_status = signal<AnalyticsBackfillStatus | null>(null);
	public mint_analytics_backfill_status = signal<AnalyticsBackfillStatus | null>(null);
	public locale!: string;
	public bitcoin_oracle_enabled: boolean;
	// derived data
	public mint_genesis_time: number = 0;
	// state
	public mint_type!: string;
	public loading_static_data: boolean = true;

	public errors_lightning: OrchardError[] = [];
	// charts
	public page_settings: WritableSignal<NonNullableMintDashboardSettings>;
	public summary_nav_items: Record<NavSummary, NavTertiaryItem> = {
		[NavSummary.Mint]: {title: 'Mint'},
		[NavSummary.BalanceSheet]: {title: 'Balance Sheet'},
	};
	public chart_nav_items: Record<NavChart, NavTertiaryItem> = {
		[NavChart.BalanceSheet]: {title: 'Balance Sheet'},
		[NavChart.Mints]: {title: 'Mints'},
		[NavChart.Melts]: {title: 'Melts'},
		[NavChart.Swaps]: {title: 'Swaps'},
		[NavChart.FeeRevenue]: {title: 'Fee Revenue'},
		[NavChart.Ecash]: {title: 'Ecash Counts'},
	};
	public chart_type_options: Record<string, ChartType[]> = {
		balance_sheet: [ChartType.Totals, ChartType.Volume],
		mints: [ChartType.Totals, ChartType.Volume],
		melts: [ChartType.Totals, ChartType.Volume],
		swaps: [ChartType.Totals, ChartType.Volume],
		fee_revenue: [ChartType.Totals, ChartType.Volume],
		ecash: [ChartType.Totals, ChartType.Volume],
	};

	public mint_fee_revenue = signal<boolean>(false);
	public device_type = signal<DeviceType>('desktop');
	public loading_mint = signal<boolean>(true);
	public loading_mint_icon = signal<boolean>(true);
	public loading_bitcoin = signal<boolean>(false);
	public loading_lightning = signal<boolean>(false);
	public bitcoin_oracle_price = signal<BitcoinOraclePrice | null>(null);
	public bitcoin_oracle_price_map = signal<Map<number, number> | null>(null);
	public mint_icon_data = signal<string | null>(null);
	public activity_summary = signal<MintActivitySummary | null>(null);
	public loading_activity = signal<boolean>(true);
	public error_activity = signal<boolean>(false);
	public selected_activity_period = signal<MintActivityPeriod>(MintActivityPeriod.Week);

	public summary_nav = computed(() => this.page_settings().summary_nav || []);
	public chart_nav = computed(() => this.page_settings().chart_nav || []);
	public type_balance_sheet = computed(() => this.page_settings().type.balance_sheet || ChartType.Totals);
	public type_mints = computed(() => this.page_settings().type.mints || ChartType.Volume);
	public type_melts = computed(() => this.page_settings().type.melts || ChartType.Volume);
	public type_swaps = computed(() => this.page_settings().type.swaps || ChartType.Volume);
	public type_fee_revenue = computed(() => this.page_settings().type.fee_revenue || ChartType.Volume);
	public type_ecash = computed(() => this.page_settings().type.ecash || ChartType.Totals);
	public loading_analytics = computed(() => this.loading_mint() || this.loading_bitcoin());
	public is_archiving = computed(
		() => !!this.mint_analytics_backfill_status()?.is_running || !!this.lightning_analytics_backfill_status()?.is_running,
	);
	public archiving_progress = computed(() => this.computeArchivingProgress());

	private subscriptions: Subscription = new Subscription();

	constructor(
		private configService: ConfigService,
		private mintService: MintService,
		private settingDeviceService: SettingDeviceService,
		private settingAppService: SettingAppService,
		private publicService: PublicService,
		private bitcoinService: BitcoinService,
		private lightningService: LightningService,
		private aiService: AiService,
		private breakpointObserver: BreakpointObserver,
		private router: Router,
		private route: ActivatedRoute,
		private cdr: ChangeDetectorRef,
	) {
		this.bitcoin_oracle_enabled = this.settingAppService.getSetting('bitcoin_oracle').value;
		this.lightning_enabled = this.configService.config.lightning.enabled;
		this.mint_type = this.configService.config.mint.type;
		this.mint_info = this.route.snapshot.data['mint_info'];
		this.mint_balances = this.route.snapshot.data['mint_balances'];
		this.mint_keysets = this.route.snapshot.data['mint_keysets'];
		this.mint_keyset_counts = this.route.snapshot.data['mint_keyset_counts'];
		this.mint_database_info = this.route.snapshot.data['mint_database_info'] ?? null;
		this.mint_genesis_time = this.getMintGenesisTime();
		this.page_settings = signal(this.getPageSettings());
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	async ngOnInit(): Promise<void> {
		this.initMintConnections();
		this.setMintIcon();
		this.orchardOptionalInit();
		if (this.mint_type === 'nutshell') this.getMintWatchdogStatus();
		this.loadActivitySummary(MintActivityPeriod.Day);
		await this.initAnalytics();
		this.mint_fee_revenue.set(this.getMintFeeRevenueState());
		this.subscriptions.add(this.getBreakpointSubscription());
	}

	orchardOptionalInit(): void {
		if (this.settingAppService.getSetting('ai_enabled').value) {
			this.subscriptions.add(this.getAssistantSubscription());
			this.subscriptions.add(this.getToolSubscription());
		}
		if (this.bitcoin_oracle_enabled) {
			this.loading_bitcoin.set(true);
			this.subscriptions.add(this.getBitcoinOraclePriceSubscription());
			this.subscriptions.add(this.getBitcoinOraclePriceMapSubscription());
		}
		if (this.lightning_enabled) {
			this.loading_lightning.set(true);
			this.subscriptions.add(this.getLightningBalanceSubscription());
		}
	}

	/**
	 * Unified archiving progress (0–99) across mint and lightning backfills.
	 * Completed streams count as whole units; the in-flight stream contributes a
	 * fraction based on how much of its `first_processed_at`→now window has been
	 * covered. Capped at 99 so 100% only shows once archiving truly finishes.
	 */
	private computeArchivingProgress(): number {
		const now = DateTime.now();
		const statusStreamFraction = (status: AnalyticsBackfillStatus | null): number => {
			if (!status?.first_processed_at || !status.last_processed_at) return 0;
			const first = DateTime.fromSeconds(status.first_processed_at);
			const last = DateTime.fromSeconds(status.last_processed_at);
			const window_seconds = now.diff(first).as('seconds');
			if (window_seconds <= 0) return 0;
			const processed_seconds = last.diff(first).as('seconds');
			return Math.max(0, Math.min(1, processed_seconds / window_seconds));
		};
		const mint = this.mint_analytics_backfill_status();
		const ln = this.lightning_analytics_backfill_status();
		let completed = 0;
		let total = 0;
		if (mint?.is_running) {
			completed += (mint.streams_completed ?? 0) + statusStreamFraction(mint);
			total += mint.total_streams ?? 0;
		}
		if (ln?.is_running) {
			completed += (ln.streams_completed ?? 0) + statusStreamFraction(ln);
			total += ln.total_streams ?? 0;
		}
		return total > 0 ? Math.min(99, Math.floor((completed / total) * 100)) : 0;
	}

	private getMintGenesisTime(): number {
		const valid_times = this.mint_keysets?.filter((keyset) => keyset.valid_from != null).map((keyset) => keyset.valid_from!) ?? [];
		return valid_times.length > 0 ? Math.min(...valid_times) : 0;
	}

	private setMintIcon(): void {
		if (!this.mint_info?.icon_url) {
			this.mint_icon_data.set(null);
			this.loading_mint_icon.set(false);
			return;
		}
		this.publicService.getPublicImageData(this.mint_info?.icon_url).subscribe((image: PublicImage) => {
			this.mint_icon_data.set(image.data);
			this.loading_mint_icon.set(false);
		});
	}

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			let context = `* **Current Date:** ${DateTime.now().toFormat('yyyy-MM-dd')}\n`;
			context += `* **Date Start:** ${DateTime.fromSeconds(this.page_settings().date_start).toFormat('yyyy-MM-dd')}\n`;
			context += `* **Date End:** ${DateTime.fromSeconds(this.page_settings().date_end).toFormat('yyyy-MM-dd')}\n`;
			context += `* **Interval:** ${this.page_settings().interval}\n`;
			context += `* **Units:** ${this.page_settings().units.join(', ')}\n`;
			this.aiService.openAiSocket(assistant, content, context);
		});
	}

	private getToolSubscription(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
		});
	}

	private getBitcoinOraclePriceSubscription(): Subscription {
		return this.bitcoinService.loadBitcoinOraclePrice().subscribe((price) => {
			this.bitcoin_oracle_price.set(price);
		});
	}

	private getBitcoinOraclePriceMapSubscription(): Subscription {
		const start_date = this.page_settings().date_start;
		const end_date = this.page_settings().date_end;
		return this.bitcoinService.loadBitcoinOraclePriceMap(start_date, end_date).subscribe((price_map) => {
			this.bitcoin_oracle_price_map.set(price_map);
			this.loading_bitcoin.set(false);
		});
	}

	private getLightningBalanceSubscription(): Subscription {
		return this.lightningService
			.loadLightningBalance()
			.pipe(
				tap((balance) => {
					this.lightning_balance = balance;
					this.cdr.detectChanges();
				}),
				catchError((error) => {
					this.errors_lightning = error.errors;
					this.cdr.detectChanges();
					return EMPTY;
				}),
				finalize(() => {
					this.loading_lightning.set(false);
				}),
			)
			.subscribe();
	}

	public getBreakpointSubscription(): Subscription {
		return this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium]).subscribe((result) => {
			if (result.breakpoints[Breakpoints.XSmall]) {
				this.device_type.set('mobile');
			} else if (result.breakpoints[Breakpoints.Small] || result.breakpoints[Breakpoints.Medium]) {
				this.device_type.set('tablet');
			} else {
				this.device_type.set('desktop');
			}
		});
	}
	/* *******************************************************
		Data                      
	******************************************************** */

	private async getMintWatchdogStatus(): Promise<void> {
		try {
			this.mint_watchdog_status = await lastValueFrom(this.mintService.loadMintWatchdogStatus());
		} catch {
			this.mint_watchdog_status = null;
		}
	}

	private getMintFeeRevenueState(): boolean {
		const fee_sum = this.mint_keysets.reduce((sum, keyset) => sum + (keyset?.fees_paid || 0), 0);
		return fee_sum > 0;
	}

	private async initMintConnections(): Promise<void> {
		if (!this.mint_info?.urls) return;
		if (this.mint_info.urls.length === 0) return;
		const test_urls = this.mint_info.urls.map((url) => {
			return `${url.replace(/\/$/, '')}${this.configService.config.mint.critical_path}`;
		});
		this.publicService.getPublicUrlsData(test_urls).subscribe((urls) => {
			this.mint_connections = urls;
			this.cdr.detectChanges();
		});
	}

	private async initAnalytics(): Promise<void> {
		try {
			this.locale = await this.settingDeviceService.getLocale();
			this.updateGridNav('summary');
			this.updateGridNav('charts');
			this.loading_static_data = false;
			this.cdr.detectChanges();
			await Promise.all([this.loadMintAnalytics(), this.lightning_enabled ? this.loadLightningAnalytics() : Promise.resolve()]);

			this.loading_mint.set(false);
			this.cdr.detectChanges();
		} catch (error) {
			this.loading_mint.set(false);
			console.error('ERROR IN INIT ANALYTICS:', error);
		}
	}

	private async loadMintAnalytics(): Promise<void> {
		const timezone = this.settingDeviceService.getTimezone();
		const base_args = {
			units: this.page_settings().units,
			date_start: this.page_settings().date_start,
			date_end: this.page_settings().date_end,
			interval: this.page_settings().interval,
			timezone,
		};
		const pre_args = {
			units: this.page_settings().units,
			date_start: this.configService.config.constants.epoch_start,
			date_end: getPreRangeEnd(this.page_settings().date_start),
			interval: AnalyticsInterval.Custom,
			timezone,
		};
		const loaders = [
			this.mintService.loadMintAnalyticsBalances.bind(this.mintService),
			this.mintService.loadMintAnalyticsMints.bind(this.mintService),
			this.mintService.loadMintAnalyticsMelts.bind(this.mintService),
			this.mintService.loadMintAnalyticsSwaps.bind(this.mintService),
			this.mintService.loadMintAnalyticsFees.bind(this.mintService),
			this.mintService.loadMintAnalyticsProofs.bind(this.mintService),
			this.mintService.loadMintAnalyticsPromises.bind(this.mintService),
		];
		const [results, backfill_status] = await lastValueFrom(
			forkJoin([
				forkJoin(loaders.flatMap((load) => [load(base_args), load(pre_args)])),
				this.mintService.getMintAnalyticsBackfillStatus(),
			]),
		);

		this.mint_analytics_balances = results[0];
		this.mint_analytics_balances_pre = results[1];
		this.mint_analytics_mints = results[2];
		this.mint_analytics_mints_pre = results[3];
		this.mint_analytics_melts = results[4];
		this.mint_analytics_melts_pre = results[5];
		this.mint_analytics_swaps = results[6];
		this.mint_analytics_swaps_pre = results[7];
		this.mint_analytics_fees = results[8];
		this.mint_analytics_fees_pre = results[9];
		this.mint_analytics_proofs = results[10];
		this.mint_analytics_proofs_pre = results[11];
		this.mint_analytics_promises = results[12];
		this.mint_analytics_promises_pre = results[13];
		this.mint_analytics_backfill_status.set(backfill_status);
	}

	private async loadLightningAnalytics(): Promise<void> {
		const timezone = this.settingDeviceService.getTimezone();
		const args: LightningAnalyticsArgs = {
			date_start: this.page_settings().date_start,
			date_end: this.page_settings().date_end,
			interval: this.page_settings().interval,
			timezone: timezone,
		};
		const [analytics, analytics_pre, backfill_status] = await lastValueFrom(
			forkJoin([
				this.lightningService.loadLightningAnalyticsLocalBalance(args),
				this.lightningService.loadLightningAnalyticsLocalBalance({
					...args,
					date_start: this.configService.config.constants.epoch_start,
					date_end: getPreRangeEnd(this.page_settings().date_start),
					interval: AnalyticsInterval.Custom,
				}),
				this.lightningService.loadLightningAnalyticsBackfillStatus(),
			]),
		);
		this.lightning_analytics = analytics;
		this.lightning_analytics_pre = analytics_pre;
		this.lightning_analytics_backfill_status.set(backfill_status);
	}

	private loadActivitySummary(period: MintActivityPeriod): void {
		this.loading_activity.set(true);
		this.error_activity.set(false);
		const timezone = this.settingDeviceService.getTimezone();
		this.mintService
			.loadMintActivitySummary(period, timezone)
			.pipe(
				tap((summary) => {
					this.activity_summary.set(summary);
				}),
				catchError(() => {
					this.error_activity.set(true);
					return EMPTY;
				}),
				finalize(() => {
					this.loading_activity.set(false);
				}),
			)
			.subscribe();
	}

	public onActivityPeriodChange(period: MintActivityPeriod): void {
		this.selected_activity_period.set(period);
		this.mintService.clearActivityCache();
		this.loadActivitySummary(period);
	}

	private async reloadDynamicData(): Promise<void> {
		try {
			this.mintService.clearDasbhoardCache();
			this.lightningService.clearAnalyticsCache();
			this.loading_mint.set(true);
			this.cdr.detectChanges();
			await Promise.all([this.loadMintAnalytics(), this.lightning_enabled ? this.loadLightningAnalytics() : Promise.resolve()]);

			this.loading_mint.set(false);
			this.cdr.detectChanges();
		} catch (error) {
			this.loading_mint.set(false);
			console.error('Error updating dynamic data:', error);
		}
	}

	/* *******************************************************
		Settings                      
	******************************************************** */

	private getPageSettings(): NonNullableMintDashboardSettings {
		const settings = this.settingDeviceService.getMintDashboardSettings();
		const date_preset = settings.date_preset ?? null;
		const resolved_dates = date_preset ? resolveDateRangePreset(date_preset, this.mint_genesis_time) : null;
		return {
			type: {
				balance_sheet: settings.type?.balance_sheet ?? ChartType.Totals,
				mints: settings.type?.mints ?? ChartType.Volume,
				melts: settings.type?.melts ?? ChartType.Volume,
				swaps: settings.type?.swaps ?? ChartType.Volume,
				fee_revenue: settings.type?.fee_revenue ?? ChartType.Volume,
				ecash: settings.type?.ecash ?? ChartType.Totals,
			},
			interval: settings.interval ?? AnalyticsInterval.Day,
			units: settings.units ?? [],
			date_start: resolved_dates?.date_start ?? settings.date_start ?? this.getSelectedDateStart(),
			date_end: resolved_dates?.date_end ?? settings.date_end ?? this.getSelectedDateEnd(),
			date_preset,
			summary_nav: settings.summary_nav ?? Object.values(NavSummary),
			chart_nav: settings.chart_nav ?? Object.values(NavChart),
			oracle_used: this.bitcoin_oracle_enabled ? (settings.oracle_used ?? false) : false,
		};
	}

	private getSelectedDateStart(): number {
		const three_months_ago = DateTime.now().minus({months: 3}).startOf('day');
		const three_months_ago_timestamp = Math.floor(three_months_ago.toSeconds());
		return Math.max(three_months_ago_timestamp, this.mint_genesis_time);
	}

	private getSelectedDateEnd(): number {
		const today = DateTime.now().endOf('day');
		return Math.floor(today.toSeconds());
	}

	public getChartType(key: ChartKey): ChartType | null {
		return this.page_settings().type[key];
	}

	/* *******************************************************
		AI                    
	******************************************************** */

	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		if (tool_call.function.name === AssistantToolName.DateRangeUpdate) {
			const range = [
				DateTime.fromFormat(tool_call.function.arguments.date_start, 'yyyy-MM-dd').toSeconds(),
				DateTime.fromFormat(tool_call.function.arguments.date_end, 'yyyy-MM-dd').toSeconds(),
			];
			this.onDateChange(range);
		}
		if (tool_call.function.name === AssistantToolName.MintAnalyticsUnitsUpdate) {
			this.onUnitsChange(tool_call.function.arguments.units);
		}
		if (tool_call.function.name === AssistantToolName.MintAnalyticsIntervalUpdate) {
			this.onIntervalChange(tool_call.function.arguments.interval);
		}
	}

	/* *******************************************************
		Actions Up                     
	******************************************************** */

	public onDateChange(event: number[]): void {
		const current = this.page_settings();
		const updated = {...current, date_start: event[0], date_end: event[1], date_preset: null};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
		this.reloadDynamicData();
	}

	public onPresetChange(preset: DateRangePreset): void {
		const {date_start, date_end} = resolveDateRangePreset(preset, this.mint_genesis_time);
		const current = this.page_settings();
		const updated = {...current, date_start, date_end, date_preset: preset};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
		this.reloadDynamicData();
	}

	public onUnitsChange(event: MintUnit[]): void {
		const current = this.page_settings();
		const updated = {...current, units: event};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
		this.reloadDynamicData();
	}

	public onIntervalChange(event: AnalyticsInterval): void {
		const current = this.page_settings();
		const updated = {...current, interval: event};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
		this.reloadDynamicData();
	}

	public onOracleUsedChange(event: boolean): void {
		const current = this.page_settings();
		const updated = {...current, oracle_used: event};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
	}

	public onChartTypeChange(key: ChartKey, type: ChartType): void {
		const current = this.page_settings();
		const updated = {
			...current,
			type: {...current.type, [key]: type},
		};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
	}

	public onNavigate(route: string): void {
		this.router.navigate([`/${route}`]);
	}

	/* *******************************************************
		Tertiary Nav                      
	******************************************************** */

	public onTertiaryNavChange(event: string[], section: NavSection): void {
		const current = this.page_settings();
		const key = section === 'summary' ? 'summary_nav' : 'chart_nav';
		const updated = {...current, [key]: event};
		this.page_settings.set(updated);
		this.settingDeviceService.setMintDashboardSettings(updated);
		this.updateGridNav(section);
	}

	public onTertiaryNavSelect(event: string, _section: NavSection): void {
		this.scrollToNav(event);
	}

	private updateGridNav(section: NavSection): void {
		const container = section === 'summary' ? this.summary_container : this.chart_container;
		if (!container) return;
		const key = section === 'summary' ? 'summary_nav' : 'chart_nav';
		const areas = this.page_settings()
			[key].map((area: string) => `"${area}"`)
			.join(' ');
		container.nativeElement.style.gridTemplateAreas = areas;
	}

	private scrollToNav(nav_item: string) {
		const target_element = this.nav_elements.find((el) => el.nativeElement.classList.contains(nav_item));
		if (!target_element?.nativeElement) return;
		setTimeout(() => {
			target_element.nativeElement.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'nearest',
			});
		}, 5);
	}

	/* *******************************************************
		Clean Up                      
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
