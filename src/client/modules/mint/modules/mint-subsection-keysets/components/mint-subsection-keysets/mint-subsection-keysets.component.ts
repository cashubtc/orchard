/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	OnInit,
	OnDestroy,
	HostListener,
	ViewChild,
	ElementRef,
	signal,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {lastValueFrom, forkJoin, Subscription} from 'rxjs';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {NonNullableMintKeysetsSettings} from '@client/modules/settings/types/setting.types';
import {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {eligibleForOracleConversion, oracleConvertToUSDCents, findNearestOraclePrice} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {getPreRangeEnd} from '@client/modules/analytics/helpers/analytics.helpers';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
import {MintSubsectionKeysetsTableRow} from '@client/modules/mint/modules/mint-subsection-keysets/classes/mint-subsection-keysets-table-row.class';
/* Shared Dependencies */
import {MintUnit, AnalyticsInterval, AssistantToolName, AiAssistant} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-keysets',
	standalone: false,
	templateUrl: './mint-subsection-keysets.component.html',
	styleUrl: './mint-subsection-keysets.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionKeysetsComponent implements ComponentCanDeactivate, OnInit, OnDestroy {
	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	@ViewChild('keyset_form', {static: false}) keyset_form!: ElementRef;

	public mint_type: string;
	public mint_keysets: MintKeyset[] = [];
	public locale!: string;
	public interval!: AnalyticsInterval;
	public mint_genesis_time: number = 0;
	public page_settings!: NonNullableMintKeysetsSettings;
	public loading_static_data: boolean = true;
	public loading_dynamic_data: boolean = true;
	public keysets_analytics: MintAnalyticKeyset[] = [];
	public keysets_analytics_pre: MintAnalyticKeyset[] = [];
	public keysets_counts: MintKeysetCount[] = [];
	public keysets_rotation: boolean = false;
	public unit_options!: {value: string; label: string}[];
	public keyset_out!: MintKeyset;
	public keyset_out_balance!: MintBalance;
	public median_notes!: number;
	public form_keyset: FormGroup;
	public device_type = signal<DeviceType>('desktop');
	public highlighted_keyset_id = signal<string | null>(null);
	public bitcoin_oracle_data = signal<{balance_cents: number; fees_cents: number; date: number} | null>(null);

	private active_event: EventData | null = null;
	private subscriptions: Subscription = new Subscription();
	private bitcoin_oracle_enabled: boolean;
	private bitcoin_oracle_price_map: Map<number, number> | null = null;

	constructor(
		public route: ActivatedRoute,
		private configService: ConfigService,
		private settingAppService: SettingAppService,
		private settingDeviceService: SettingDeviceService,
		private eventService: EventService,
		private aiService: AiService,
		private mintService: MintService,
		private bitcoinService: BitcoinService,
		private cdr: ChangeDetectorRef,
		private breakpointObserver: BreakpointObserver,
	) {
		this.bitcoin_oracle_enabled = this.settingAppService.getSetting('bitcoin_oracle').value;
		this.mint_type = this.configService.config.mint.type;
		this.form_keyset = new FormGroup({
			unit: new FormControl(null, [Validators.required]),
			input_fee_ppk: new FormControl(null, [Validators.required, Validators.min(0), Validators.max(100000)]),
			amounts: new FormControl(null, [Validators.required]),
			max_order: new FormControl(null),
			default_amounts: new FormControl(true),
			keyset_v2: new FormControl(this.mint_type === 'nutshell' ? false : true),
		});
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	ngOnInit(): void {
		this.mint_keysets = this.route.snapshot.data['mint_keysets'];
		this.keysets_counts = this.route.snapshot.data['mint_keyset_counts'];
		this.unit_options = this.getUnitOptions();
		this.resetForm();
		this.initKeysetsAnalytics();
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.orchardOptionalInit();
	}

	orchardOptionalInit(): void {
		if (this.settingAppService.getSetting('ai_enabled').value) {
			this.subscriptions.add(this.getAssistantSubscription());
			this.subscriptions.add(this.getToolSubscription());
		}
		if (this.bitcoin_oracle_enabled) {
			this.subscriptions.add(this.getBitcoinOraclePriceMapSubscription());
		}
	}

	private getUnitOptions(): {value: string; label: string}[] {
		const possible_units = Array.from(new Set(this.mint_keysets.map((keyset) => keyset.unit)));
		return possible_units.map((unit) => ({value: unit, label: unit.toUpperCase()}));
	}

	private getMintGenesisTime(): number {
		const valid_times = this.mint_keysets?.filter((keyset) => keyset.valid_from != null).map((keyset) => keyset.valid_from!) ?? [];
		return valid_times.length > 0 ? Math.min(...valid_times) : 0;
	}

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getEventSubscription(): Subscription {
		return this.eventService.getActiveEvent().subscribe((event_data: EventData | null) => {
			this.active_event = event_data;
			if (event_data === null) {
				setTimeout(() => {
					if (!this.keysets_rotation) return;
					this.eventService.registerEvent(
						new EventData({
							type: 'PENDING',
							message: 'Save',
						}),
					);
				}, 1000);
			}
			if (event_data) {
				if (event_data.type === 'SUCCESS') this.onSuccessEvent();
				if (event_data.confirmed !== null) event_data.confirmed ? this.onConfirmedEvent() : this.onCloseRotation();
			}
		});
	}

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			this.keysets_rotation
				? this.hireRotationAssistant(AiAssistant.MintKeysetRotation, content)
				: this.hireAnalyticsAssistant(assistant, content);
		});
	}

	private getToolSubscription(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
		});
	}

	private getBitcoinOraclePriceMapSubscription(): Subscription {
		return this.bitcoinService
			.loadBitcoinOraclePriceMap(this.page_settings.date_start, this.page_settings.date_end)
			.subscribe((price_map) => {
				this.bitcoin_oracle_price_map = price_map;
			});
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

	private async initKeysetsAnalytics(): Promise<void> {
		this.locale = this.settingDeviceService.getLocale();
		this.mint_genesis_time = this.getMintGenesisTime();
		this.page_settings = this.getPageSettings();
		this.interval = this.getAnalyticsInterval();
		const timezone = this.settingDeviceService.getTimezone();
		this.loading_static_data = false;
		this.cdr.detectChanges();
		await this.loadKeysetsAnalytics(timezone, this.interval);
		this.loading_dynamic_data = false;
		this.cdr.detectChanges();
	}

	private getAnalyticsInterval(): AnalyticsInterval {
		const effective_date_start = Math.max(this.page_settings.date_start, this.mint_genesis_time);
		const days_diff = DateTime.fromSeconds(this.page_settings.date_end).diff(DateTime.fromSeconds(effective_date_start), 'days').days;
		if (days_diff <= 90) return AnalyticsInterval.Day;
		if (days_diff <= 365) return AnalyticsInterval.Week;
		return AnalyticsInterval.Month;
	}

	private async loadKeysetsAnalytics(timezone: string, interval: AnalyticsInterval): Promise<void> {
		const analytics_keysets_obs = this.mintService.loadMintAnalyticsKeysets({
			date_start: this.page_settings.date_start,
			date_end: this.page_settings.date_end,
			interval: interval,
			timezone: timezone,
		});
		const analytics_keysets_pre_obs = this.mintService.loadMintAnalyticsKeysets({
			date_start: this.configService.config.constants.epoch_start,
			date_end: getPreRangeEnd(this.page_settings.date_start),
			interval: AnalyticsInterval.Custom,
			timezone: timezone,
		});
		const [analytics_keysets, analytics_keysets_pre] = await lastValueFrom(
			forkJoin([analytics_keysets_obs, analytics_keysets_pre_obs]),
		);

		this.keysets_analytics = analytics_keysets;
		this.keysets_analytics_pre = analytics_keysets_pre;
	}

	private async reloadDynamicData(): Promise<void> {
		try {
			this.mintService.clearKeysetsCache();
			this.loading_dynamic_data = true;
			this.highlighted_keyset_id.set(null);
			this.cdr.detectChanges();
			this.interval = this.getAnalyticsInterval();
			const timezone = this.settingDeviceService.getTimezone();
			this.cdr.detectChanges();
			await this.loadKeysetsAnalytics(timezone, this.interval);
			this.loading_dynamic_data = false;
			this.cdr.detectChanges();
		} catch (error) {
			console.error('Error updating dynamic data:', error);
		}
	}

	private async getMintKeysetBalance(): Promise<void> {
		this.mintService.getMintKeysetBalance(this.keyset_out.id).subscribe((mint_balance) => {
			this.keyset_out_balance = mint_balance;
			this.cdr.detectChanges();
		});
	}

	private async getMintProofGroupStats(): Promise<void> {
		this.mintService.getMintProofGroupStats(this.keyset_out.unit).subscribe((stats) => {
			this.median_notes = stats.mint_proof_group_stats.median;
			this.cdr.detectChanges();
		});
	}

	/* *******************************************************
		Form                      
	******************************************************** */

	private resetForm(unit?: MintUnit): void {
		this.form_keyset.markAsPristine();
		const form_unit = unit ?? this.getDefaultUnit();
		const form_input_fee_ppk = this.getKeysetInputFeePpk(form_unit);
		const form_amounts = Array.from({length: 32}, (_, i) => Math.pow(2, i));
		this.keyset_out = this.getKeysetOut(form_unit);
		this.form_keyset.patchValue({
			unit: form_unit,
			input_fee_ppk: form_input_fee_ppk,
			amounts: form_amounts,
			max_order: 32,
			default_amounts: true,
			keyset_v2: this.mint_type === 'nutshell' ? false : true,
		});
		if (this.mint_type === 'nutshell') {
			this.form_keyset.get('default_amounts')?.disable();
		}
	}

	private getDefaultUnit(): MintUnit {
		const possible_units = Array.from(new Set(this.mint_keysets.map((keyset) => keyset.unit)));
		if (possible_units.includes(MintUnit.Sat)) return MintUnit.Sat;
		return this.mint_keysets.reduce(
			(most_common_unit, keyset) => {
				const count = this.mint_keysets.filter((k) => k.unit === keyset.unit).length;
				return count > most_common_unit.count ? {unit: keyset.unit, count: count} : most_common_unit;
			},
			{unit: this.mint_keysets[0].unit, count: 0},
		).unit;
	}

	private getKeysetInputFeePpk(unit: MintUnit): number {
		const active_keyset = this.mint_keysets.find((keyset) => keyset.unit === unit && keyset.active);
		return active_keyset?.input_fee_ppk ?? 1000;
	}

	private getKeysetOut(unit: MintUnit): MintKeyset {
		return (
			this.mint_keysets
				.filter((keyset) => keyset.unit === unit && keyset.active)
				.sort((a, b) => (a.valid_from ?? 0) - (b.valid_from ?? 0))
				.pop() ?? this.mint_keysets[0]
		);
	}

	private onConfirmedEvent(): void {
		if (this.form_keyset.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid keyset',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		const {unit, input_fee_ppk, amounts, keyset_v2} = this.form_keyset.value;
		this.mintService.rotateMintKeysets(unit, input_fee_ppk, amounts, keyset_v2).subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Rotation complete!',
					}),
				);
			},
			error: (errors: OrchardErrors) => {
				this.eventService.registerEvent(
					new EventData({
						type: 'ERROR',
						message: errors.errors[0].getFullError(),
					}),
				);
			},
		});
	}

	private async onSuccessEvent(): Promise<void> {
		this.keysets_rotation = false;
		this.cdr.detectChanges();
		this.mintService.clearKeysetsCache();
		const mint_keysets = await lastValueFrom(this.mintService.loadMintKeysets());
		this.mint_keysets = mint_keysets;
		this.resetForm();
		await this.reloadDynamicData();
	}

	private initKeysetsRotation(): void {
		this.keysets_rotation = true;
		this.eventService.registerEvent(
			new EventData({
				type: 'PENDING',
				message: 'Save',
			}),
		);
		this.keyset_form.nativeElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
			inline: 'nearest',
		});
		this.getMintKeysetBalance();
		this.getMintProofGroupStats();
	}

	/* *******************************************************
		Page Settings                      
	******************************************************** */

	private getPageSettings(): NonNullableMintKeysetsSettings {
		const settings = this.settingDeviceService.getMintKeysetsSettings();
		const date_preset = settings.date_preset ?? null;
		const resolved_dates = date_preset ? resolveDateRangePreset(date_preset, this.mint_genesis_time) : null;
		return {
			units: settings.units ?? [],
			date_start: resolved_dates?.date_start ?? settings.date_start ?? this.mint_genesis_time,
			date_end: resolved_dates?.date_end ?? settings.date_end ?? this.getSelectedDateEnd(),
			date_preset,
			status: settings.status ?? [],
		};
	}

	private getSelectedDateEnd(): number {
		const today = DateTime.now().endOf('day');
		return Math.floor(today.toSeconds());
	}

	/* *******************************************************
		AI                     
	******************************************************** */

	private hireAnalyticsAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Current Date:** ${DateTime.now().toFormat('yyyy-MM-dd')}\n`;
		context += `* **Date Start:** ${DateTime.fromSeconds(this.page_settings.date_start).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Date End:** ${DateTime.fromSeconds(this.page_settings.date_end).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Units:** ${this.page_settings.units}\n`;
		context += `* **Status:** ${this.page_settings.status}\n`;
		context += `* **Available Units:** ${this.unit_options.map((unit) => unit.value).join(', ')}\n`;
		this.aiService.openAiSocket(assistant, content, context);
	}
	private hireRotationAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Current Unit:** ${this.form_keyset.value.unit}\n`;
		context += `* **Input Fee PPK:** ${this.form_keyset.value.input_fee_ppk}\n`;
		context += `* **Amounts:** ${this.form_keyset.value.amounts}\n`;
		context += `* **Available Units:** ${this.unit_options.map((unit) => unit.value).join(', ')}\n`;
		this.aiService.openAiSocket(assistant, content, context);
	}

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
		if (tool_call.function.name === AssistantToolName.MintKeysetStatusUpdate) {
			const statuses =
				typeof tool_call.function.arguments.statuses === 'string'
					? JSON.parse(tool_call.function.arguments.statuses).map((status: any) => status === 'true' || status === true)
					: tool_call.function.arguments.statuses.map((status: any) => status === 'true' || status === true);
			this.onStatusChange(statuses);
		}
		if (tool_call.function.name === AssistantToolName.MintKeysetRotationUnitUpdate) {
			this.form_keyset.patchValue({
				unit: tool_call.function.arguments.unit,
			});
		}
		if (tool_call.function.name === AssistantToolName.MintKeysetRotationInputFeePpkUpdate) {
			this.form_keyset.patchValue({
				input_fee_ppk: tool_call.function.arguments.input_fee_ppk,
			});
		}
		if (tool_call.function.name === AssistantToolName.MintKeysetRotationAmountsUpdate) {
			this.form_keyset.patchValue({
				amounts: tool_call.function.arguments.amounts,
			});
		}
	}

	/* *******************************************************
		Actions Up                     
	******************************************************** */

	public onDateChange(event: number[]): void {
		this.page_settings.date_start = event[0];
		this.page_settings.date_end = event[1];
		this.page_settings.date_preset = null;
		this.settingDeviceService.setMintKeysetsSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onPresetChange(preset: DateRangePreset): void {
		const {date_start, date_end} = resolveDateRangePreset(preset, this.mint_genesis_time);
		this.page_settings.date_start = date_start;
		this.page_settings.date_end = date_end;
		this.page_settings.date_preset = preset;
		this.settingDeviceService.setMintKeysetsSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onUnitsChange(event: MintUnit[]): void {
		this.page_settings.units = event;
		this.settingDeviceService.setMintKeysetsSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onStatusChange(event: boolean[]): void {
		this.page_settings.status = event;
		this.settingDeviceService.setMintKeysetsSettings(this.page_settings);
		this.reloadDynamicData();
	}

	/**
	 * Handles highlight change from table row hover or toggle
	 * @param keyset_id - the keyset ID to highlight, or null to clear
	 */
	public onHighlightChange(keyset_id: string | null): void {
		this.highlighted_keyset_id.set(keyset_id);
	}

	public onRotation(): void {
		!this.keysets_rotation ? this.initKeysetsRotation() : this.onCloseRotation();
	}

	public onRotationUnit(unit: MintUnit): void {
		this.resetForm(unit);
		this.initKeysetsRotation();
	}

	public onCloseRotation(): void {
		this.keysets_rotation = false;
		this.eventService.registerEvent(null);
		this.cdr.detectChanges();
	}

	public onMoreRequest(keyset: MintSubsectionKeysetsTableRow): void {
		if (this.bitcoin_oracle_enabled) {
			this.calculateBitcoinOraclePrice(keyset);
		}
	}

	public onUpdateUnit(unit: MintUnit): void {
		this.keyset_out = this.getKeysetOut(unit);
		this.getMintKeysetBalance();
		this.cdr.detectChanges();
	}

	/* *******************************************************
		Oracle Conversion
	******************************************************** */

	private calculateBitcoinOraclePrice(keyset: MintSubsectionKeysetsTableRow): void {
		if (!this.bitcoin_oracle_price_map) return;
		if (!eligibleForOracleConversion(keyset.unit)) return;
		const oracle_price = findNearestOraclePrice(this.bitcoin_oracle_price_map, this.page_settings.date_end);
		const price = oracle_price?.price || null;
		const date = oracle_price?.date || null;
		const balance_cents = oracleConvertToUSDCents(keyset.balance, price, keyset.unit);
		const fees_cents = oracleConvertToUSDCents(keyset.fees_paid, price, keyset.unit);
		const data = balance_cents !== null && fees_cents !== null && date ? {balance_cents, fees_cents, date} : null;
		this.bitcoin_oracle_data.set(data);
	}

	/* *******************************************************
		Clean Up
	******************************************************** */

	ngOnDestroy(): void {
		this.keysets_rotation = false;
		this.subscriptions.unsubscribe();
	}
}
