/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	ChangeDetectorRef,
	HostListener,
	OnDestroy,
	ViewChild,
	ElementRef,
	signal,
} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {lastValueFrom, Subscription} from 'rxjs';
import {PageEvent} from '@angular/material/paginator';
import {MatTableDataSource} from '@angular/material/table';
import {MatDialog} from '@angular/material/dialog';
/* Application Dependencies */
import {NonNullableMintDatabaseSettings} from '@client/modules/settings/types/setting.types';
import {ConfigService} from '@client/modules/config/services/config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {DataType} from '@client/modules/orchard/enums/data.enum';
import {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {LightningRequest} from '@client/modules/lightning/classes/lightning-request.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {oracleConvertToUSDCents, findNearestOraclePrice} from '@client/modules/bitcoin/helpers/oracle.helpers';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintSwap} from '@client/modules/mint/classes/mint-swap.class';
import {MintDataType} from '@client/modules/mint/enums/data-type.enum';
import {MintSubsectionDatabaseData} from '@client/modules/mint/modules/mint-subsection-database/classes/mint-subsection-database-data.class';
import {MintSubsectionDatabaseDialogQuoteComponent} from '@client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database-dialog-quote/mint-subsection-database-dialog-quote.component';
/* Shared Dependencies */
import {MintUnit, MintQuoteState, MeltQuoteState, AiAssistant, AssistantToolName} from '@shared/generated.types';

enum FormMode {
	CREATE = 'CREATE',
	RESTORE = 'RESTORE',
}

@Component({
	selector: 'orc-mint-subsection-database',
	standalone: false,
	templateUrl: './mint-subsection-database.component.html',
	styleUrl: './mint-subsection-database.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDatabaseComponent implements ComponentCanDeactivate, OnInit, OnDestroy {
	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	@ViewChild('backup_form', {static: false}) backup_form!: ElementRef;
	@ViewChild('restore_form', {static: false}) restore_form!: ElementRef;

	public page_settings!: NonNullableMintDatabaseSettings;
	public filter: string = '';
	public locale!: string;
	public mint_genesis_time: number = 0;
	public loading_static_data: boolean = true;
	public loading_dynamic_data: boolean = true;
	public loading_more: boolean = false;
	public data!: MintSubsectionDatabaseData;
	public count: number = 0;
	public mint_keysets: MintKeyset[] = [];
	public form_mode!: FormMode | null;
	public form_backup: FormGroup = new FormGroup({
		filename: new FormControl(null, [Validators.required, Validators.maxLength(1000)]),
	});
	public form_restore: FormGroup = new FormGroup({
		file: new FormControl(null, [Validators.required]),
		filebase64: new FormControl(null, [Validators.required]),
	});
	public unit_options!: {value: string; label: string}[];
	public state_options!: string[];
	public database_version!: string;
	public database_timestamp!: number;
	public database_implementation!: string;
	public lightning_request!: LightningRequest | null;

	public device_type = signal<DeviceType>('desktop');
	public bitcoin_oracle_data = signal<{price_cents: number; date: number} | null>(null);
	public highlighted_entity_id = signal<string | null>(null);

	private active_event: EventData | null = null;
	private subscriptions: Subscription = new Subscription();
	private backup_encoded: string = '';
	private bitcoin_oracle_enabled: boolean;
	private lightning_enabled: boolean;
	private bitcoin_oracle_price_map: Map<number, number> | null = null;

	public get state_enabled(): boolean {
		return this.data?.type === DataType.MintMints || this.data?.type === DataType.MintMelts;
	}

	constructor(
		private route: ActivatedRoute,
		private configService: ConfigService,
		private settingAppService: SettingAppService,
		private settingDeviceService: SettingDeviceService,
		private eventService: EventService,
		private mintService: MintService,
		private bitcoinService: BitcoinService,
		private lightningService: LightningService,
		private aiService: AiService,
		private breakpointObserver: BreakpointObserver,
		private dialog: MatDialog,
		private cdr: ChangeDetectorRef,
	) {
		this.lightning_enabled = this.configService.config.lightning.enabled;
		this.bitcoin_oracle_enabled = this.settingAppService.getSetting('bitcoin_oracle').value;
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	ngOnInit(): void {
		this.mint_keysets = this.route.snapshot.data['mint_keysets'];
		this.unit_options = this.getUnitOptions();
		this.form_backup.reset();
		this.initData();
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getFormSubscription());
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

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getEventSubscription(): Subscription {
		return this.eventService.getActiveEvent().subscribe((event_data: EventData | null) => {
			this.eventReaction(event_data);
		});
	}

	private getFormSubscription(): Subscription {
		return this.form_restore.valueChanges.subscribe(() => {
			if (this.form_restore.dirty)
				this.eventService.registerEvent(
					new EventData({
						type: 'PENDING',
						message: 'Restore',
					}),
				);
		});
	}

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			switch (this.form_mode) {
				case FormMode.CREATE:
					return this.hireBackupAssistant(AiAssistant.MintBackup, content);
				default:
					return this.hireAnalyticsAssistant(assistant, content);
			}
		});
	}

	private getToolSubscription(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
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

	private getBitcoinOraclePriceMapSubscription(): Subscription {
		return this.bitcoinService
			.loadBitcoinOraclePriceMap(this.page_settings.date_start, this.page_settings.date_end)
			.subscribe((price_map) => {
				this.bitcoin_oracle_price_map = price_map;
			});
	}

	/* *******************************************************
		Controls                      
	******************************************************** */

	private getPageSettings(): NonNullableMintDatabaseSettings {
		const settings = this.settingDeviceService.getMintDatabaseSettings();
		const type = settings.type ?? MintDataType.MintMints;
		const date_preset = settings.date_preset ?? null;
		const resolved_dates = date_preset ? resolveDateRangePreset(date_preset, this.mint_genesis_time) : null;
		return {
			type: type,
			date_start: resolved_dates?.date_start ?? settings.date_start ?? this.mint_genesis_time,
			date_end: resolved_dates?.date_end ?? settings.date_end ?? this.getDefaultDateEnd(),
			date_preset,
			page: settings.page ?? 1,
			page_size: settings.page_size ?? 100,
			units: settings.units ?? [],
			states: settings.states ?? [],
		};
	}

	private getUnitOptions(): {value: string; label: string}[] {
		const possible_units = Array.from(new Set(this.mint_keysets.map((keyset) => keyset.unit)));
		return possible_units.map((unit) => ({value: unit, label: unit.toUpperCase()}));
	}

	private getDefaultDateEnd(): number {
		const today = DateTime.now().endOf('day');
		return Math.floor(today.toSeconds());
	}

	private getDefaultStates(type: MintDataType): string[] {
		if (type === MintDataType.MintMints) return Object.values(MintQuoteState);
		if (type === MintDataType.MintMelts) return Object.values(MeltQuoteState);
		if (type === MintDataType.MintSwaps) return [];
		return [];
	}

	private getMintGenesisTime(): number {
		const valid_times = this.mint_keysets?.filter((keyset) => keyset.valid_from != null).map((keyset) => keyset.valid_from!) ?? [];
		return valid_times.length > 0 ? Math.min(...valid_times) : 0;
	}

	/* *******************************************************
		Data Down                     
	******************************************************** */

	private async initData(): Promise<void> {
		this.locale = this.settingDeviceService.getLocale();
		this.mint_genesis_time = this.getMintGenesisTime();
		this.page_settings = this.getPageSettings();
		this.state_options = this.getDefaultStates(this.page_settings.type);
		this.loading_static_data = false;
		this.cdr.detectChanges();
		await this.getDynamicData();
		this.loading_dynamic_data = false;
		this.cdr.detectChanges();
	}

	private async getDynamicData(): Promise<void> {
		if (this.page_settings.type === MintDataType.MintMints) return this.getMintsData();
		if (this.page_settings.type === MintDataType.MintMelts) return this.getMeltsData();
		if (this.page_settings.type === MintDataType.MintSwaps) return this.getSwapsData();
	}

	private async getMintsData(): Promise<void> {
		const mint_mint_quotes_data = await lastValueFrom(
			this.mintService.getMintMintQuotesData({
				date_start: this.page_settings.date_start,
				date_end: this.page_settings.date_end,
				units: this.page_settings.units.length > 0 ? this.page_settings.units : undefined,
				states: this.page_settings.states.length > 0 ? (this.page_settings.states as MintQuoteState[]) : undefined,
				page: this.page_settings.page,
				page_size: this.page_settings.page_size,
			}),
		);
		this.data = {
			type: DataType.MintMints,
			source: new MatTableDataSource(mint_mint_quotes_data.mint_mint_quotes),
		};
		this.count = mint_mint_quotes_data.count;
	}

	private async getMeltsData(): Promise<void> {
		const mint_melt_quotes_data = await lastValueFrom(
			this.mintService.getMintMeltQuotesData({
				date_start: this.page_settings.date_start,
				date_end: this.page_settings.date_end,
				units: this.page_settings.units.length > 0 ? this.page_settings.units : undefined,
				states: this.page_settings.states.length > 0 ? (this.page_settings.states as MeltQuoteState[]) : undefined,
				page: this.page_settings.page,
				page_size: this.page_settings.page_size,
			}),
		);
		this.data = {
			type: DataType.MintMelts,
			source: new MatTableDataSource(mint_melt_quotes_data.mint_melt_quotes),
		};
		this.count = mint_melt_quotes_data.count;
	}

	private async getSwapsData(): Promise<void> {
		const mint_swaps_data = await lastValueFrom(
			this.mintService.getMintSwapsData({
				date_start: this.page_settings.date_start,
				date_end: this.page_settings.date_end,
				units: this.page_settings.units.length > 0 ? this.page_settings.units : undefined,
				page: this.page_settings.page,
				page_size: this.page_settings.page_size,
			}),
		);

		this.data = {
			type: DataType.MintSwaps,
			source: new MatTableDataSource(mint_swaps_data.mint_swaps),
		};
		this.count = mint_swaps_data.count;
	}

	private async reloadDynamicData(): Promise<void> {
		try {
			this.loading_dynamic_data = true;
			this.highlighted_entity_id.set(null);
			this.cdr.detectChanges();
			await this.getDynamicData();
			this.loading_dynamic_data = false;
			this.cdr.detectChanges();
		} catch (error) {
			console.error('Error updating dynamic data:', error);
		}
	}

	/**
	 * Decodes a Lightning payment request for the expanded quote details.
	 * Decode failures clear the row loading state so malformed requests do not wedge the UI.
	 * @param {string} request - bolt11 invoice or bolt12 offer to decode
	 */
	private async getLightningRequest(request: string): Promise<void> {
		try {
			this.lightning_request = await lastValueFrom(this.lightningService.getLightningRequest(request));
		} catch (error) {
			console.error('Error decoding lightning request:', error);
			this.lightning_request = null;
		} finally {
			this.loading_more = false;
			this.cdr.detectChanges();
		}
	}

	/* *******************************************************
		Actions Up                      
	******************************************************** */

	public onDateChange(event: number[]): void {
		this.page_settings.date_start = event[0];
		this.page_settings.date_end = event[1];
		this.page_settings.date_preset = null;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onPresetChange(preset: DateRangePreset): void {
		const {date_start, date_end} = resolveDateRangePreset(preset, this.mint_genesis_time);
		this.page_settings.date_start = date_start;
		this.page_settings.date_end = date_end;
		this.page_settings.date_preset = preset;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onTypeChange(event: MintDataType): void {
		const default_states = this.getDefaultStates(event);
		this.page_settings.type = event;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.state_options = default_states;
		this.reloadDynamicData();
	}

	public onUnitsChange(event: MintUnit[]): void {
		this.page_settings.units = event;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onStatesChange(event: string[]): void {
		this.page_settings.states = event;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onPage(event: PageEvent): void {
		this.page_settings.page = event.pageIndex + 1;
		this.page_settings.page_size = event.pageSize;
		this.settingDeviceService.setMintDatabaseSettings(this.page_settings);
		this.reloadDynamicData();
	}

	public onFilterChange(event: Event): void {
		this.filter = (event.target as HTMLInputElement).value;
		this.data.source.filter = this.filter.trim().toLowerCase();
		this.cdr.detectChanges();
	}

	public onCreate(): void {
		this.form_mode !== FormMode.CREATE ? this.initCreateBackup() : this.onClose();
	}
	public onRestore(): void {
		this.form_mode !== FormMode.RESTORE ? this.initRestoreBackup() : this.onClose();
	}
	public onRefresh(): void {
		this.reloadDynamicData();
	}

	public onClose(): void {
		this.form_backup.reset();
		this.form_restore.reset();
		this.setFormMode(null);
		this.eventService.registerEvent(null);
		this.cdr.detectChanges();
	}
	/**
	 * Handles highlight change from table row hover or toggle
	 * @param entity_id - the entity ID to highlight, or null to clear
	 */
	public onHighlightChange(entity_id: string | null): void {
		this.highlighted_entity_id.set(entity_id);
	}

	/**
	 * Loads optional detail data when a database row is expanded.
	 * Lightning decode is limited to Lightning payment methods so onchain addresses are not sent to LN decoders.
	 * @param {MintMintQuote | MintMeltQuote | MintSwap} entity - expanded database entity
	 */
	public onMoreRequest(entity: MintMintQuote | MintMeltQuote | MintSwap): void {
		this.lightning_request = null;
		if (this.bitcoin_oracle_enabled) {
			this.calculateBitcoinOraclePrice(entity);
		}
		if (!('request' in entity)) return;
		if (!this.lightning_enabled) return;
		if (entity.payment_method !== 'bolt11' && entity.payment_method !== 'bolt12') return;
		this.loading_more = true;
		this.cdr.detectChanges();
		this.getLightningRequest(entity.request);
	}

	public onSetQuoteStatePaid(quote: MintMintQuote | MintMeltQuote): void {
		const is_mint_quote = this.data.type === DataType.MintMints;
		const dialog_ref = this.dialog.open(MintSubsectionDatabaseDialogQuoteComponent, {
			data: {
				quote: quote,
				type: is_mint_quote ? DataType.MintMints : DataType.MintMelts,
			},
		});
		dialog_ref.afterClosed().subscribe((confirmed) => {
			if (confirmed === true) is_mint_quote ? this.updateMintQuoteStatePaid(quote.id) : this.updateMeltQuoteStatePaid(quote.id);
		});
	}

	private updateMintQuoteStatePaid(quote_id: string): void {
		this.mintService.updateMintNut04Quote(quote_id, 'PAID').subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Quote state updated to PAID',
					}),
				);
				this.reloadDynamicData();
			},
			error: (errors: OrchardErrors) => {
				console.error('Error updating quote state:', errors);
				this.eventService.registerEvent(
					new EventData({
						type: 'ERROR',
						message: errors.errors[0].getFullError(),
					}),
				);
			},
		});
	}

	private updateMeltQuoteStatePaid(quote_id: string): void {
		this.mintService.updateMintNut05Quote(quote_id, 'PAID').subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Quote state updated to PAID',
					}),
				);
				this.reloadDynamicData();
			},
			error: (errors: OrchardErrors) => {
				console.error('Error updating quote state:', errors);
				this.eventService.registerEvent(
					new EventData({
						type: 'ERROR',
						message: errors.errors[0].getFullError(),
					}),
				);
			},
		});
	}

	/* *******************************************************
		Oracle Conversion                      
	******************************************************** */

	private calculateBitcoinOraclePrice(entity: MintMintQuote | MintMeltQuote | MintSwap): void {
		if (!this.bitcoin_oracle_price_map) return;
		const amount = entity.amount ?? ('amount_paid' in entity ? entity.amount_paid : null);
		if (!amount) return;
		if (!entity.unit) return;
		if (!entity.created_time) return;
		const unit = entity.unit;
		const oracle_price = findNearestOraclePrice(this.bitcoin_oracle_price_map, entity.created_time);
		const price = oracle_price?.price || null;
		const date = oracle_price?.date || null;
		const usd_cents = oracleConvertToUSDCents(amount, price, unit);
		const data = usd_cents && date ? {price_cents: usd_cents, date: date} : null;
		this.bitcoin_oracle_data.set(data);
	}

	/* *******************************************************
		Database Forms                
	******************************************************** */

	/** Single write path for `form_mode` so the assistant override always tracks it.
	 *  RESTORE clears deliberately — its hire path uses the route assistant. */
	private setFormMode(mode: FormMode | null): void {
		this.form_mode = mode;
		if (mode === FormMode.CREATE) this.aiService.setAssistantOverride(AiAssistant.MintBackup);
		else this.aiService.clearAssistantOverride();
	}

	private initCreateBackup(): void {
		this.setFormMode(FormMode.CREATE);
		this.eventService.registerEvent(
			new EventData({
				type: 'PENDING',
				message: 'Save',
			}),
		);
		this.backup_form.nativeElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
			inline: 'nearest',
		});
		this.getDefaultFilename();
	}

	private initRestoreBackup(): void {
		this.setFormMode(FormMode.RESTORE);
		this.restore_form.nativeElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
			inline: 'nearest',
		});
	}

	private async getDefaultFilename(): Promise<void> {
		this.mintService.loadMintInfo().subscribe((mint_info) => {
			this.database_version = mint_info.version.replace(/\//g, '-');
			this.database_timestamp = DateTime.now().toUnixInteger();
			this.database_implementation = this.configService.config.mint.database_type;
			const extension = this.database_implementation === 'sqlite' ? 'db' : 'sql';
			const filename = `MintDatabaseBackup-${this.database_version}-${DateTime.fromSeconds(this.database_timestamp).toFormat('yyyyMMdd-HHmmss')}.${extension}`;
			this.form_backup.patchValue({
				filename: filename,
			});
		});
	}

	private eventReaction(event_data: EventData | null): void {
		this.active_event = event_data;
		if (event_data === null) {
			setTimeout(() => {
				if (this.form_mode !== FormMode.CREATE && this.form_mode !== FormMode.RESTORE) return;
				this.eventService.registerEvent(
					new EventData({
						type: 'PENDING',
						message: 'Save',
					}),
				);
			}, 1000);
		}
		if (event_data) {
			if (this.form_mode === FormMode.CREATE) {
				if (event_data.type === 'SUCCESS') this.eventCreateSuccess();
				if (event_data.type === 'ERROR') this.eventError();
				if (event_data.confirmed !== null) event_data.confirmed ? this.eventCreateConfirmed() : this.onClose();
			}
			if (this.form_mode === FormMode.RESTORE) {
				if (event_data.type === 'SUCCESS') this.eventRestoreSuccess();
				if (event_data.type === 'ERROR') this.eventError();
				if (event_data.confirmed !== null) event_data.confirmed ? this.eventRestoreConfirmed() : this.onClose();
			}
		}
	}

	private eventCreateConfirmed(): void {
		if (this.form_backup.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid filename',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.mintService.createMintDatabaseBackup().subscribe({
			next: (response) => {
				this.backup_encoded = response.mint_database_backup.filebase64;
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Backup created!',
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
	private eventRestoreConfirmed(): void {
		if (this.form_restore.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid backup file',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.mintService.restoreMintDatabaseBackup(this.form_restore.get('filebase64')?.value).subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Backup restored!',
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

	private eventCreateSuccess(): void {
		const decoded_data = atob(this.backup_encoded);
		const uint8_array = Uint8Array.from(decoded_data, (c) => c.charCodeAt(0));
		const file = new File([uint8_array], this.form_backup.get('filename')?.value, {type: 'application/octet-stream'});
		const url = URL.createObjectURL(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = this.form_backup.get('filename')?.value;
		a.click();
		this.setFormMode(null);
		this.backup_encoded = '';
		this.cdr.detectChanges();
	}

	private async eventRestoreSuccess(): Promise<void> {
		this.setFormMode(null);
		this.form_restore.reset();
		this.cdr.detectChanges();
		await this.getDynamicData();
		this.cdr.detectChanges();
	}

	private eventError(): void {
		this.setFormMode(null);
		this.form_backup.reset();
		this.form_restore.reset();
		this.cdr.detectChanges();
	}

	/* *******************************************************
	   Assistant
	******************************************************** */

	private hireAnalyticsAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Current Date:** ${DateTime.now().toFormat('yyyy-MM-dd')}\n`;
		context += `* **Date Start:** ${DateTime.fromSeconds(this.page_settings.date_start).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Date End:** ${DateTime.fromSeconds(this.page_settings.date_end).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Data Type:** ${this.page_settings.type}\n`;
		context += `* **Units:** ${this.page_settings.units.join(', ')}\n`;
		context += `* **States:** ${this.page_settings.states.join(', ')}\n`;
		context += `* **Available Data Types:** ${Object.values(MintDataType).join(', ')}\n`;
		context += `* **Available Units:** ${this.unit_options.map((unit) => unit.value).join(', ')}`;
		this.aiService.openAiSocket(assistant, content, context);
	}

	private hireBackupAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Mint Version:** ${this.database_version}\n`;
		context += `* **Mint Timestamp:** ${DateTime.fromSeconds(this.database_timestamp).toFormat('yyyy-MM-dd HH:mm:ss')}\n`;
		context += `* **Mint Implementation:** ${this.database_implementation}\n`;
		context += `* **Backup Filename:** ${this.form_backup.get('filename')?.value}`;
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
		if (tool_call.function.name === AssistantToolName.MintDatabaseDataTypeUpdate) {
			if (tool_call.function.arguments.type && Object.values(MintDataType).includes(tool_call.function.arguments.type)) {
				this.onTypeChange(tool_call.function.arguments.type);
			} else {
				console.warn('Invalid MintDataType received:', tool_call.function.arguments.type);
			}
		}
		if (tool_call.function.name === AssistantToolName.MintAnalyticsUnitsUpdate) {
			if (
				tool_call.function.arguments.units &&
				tool_call.function.arguments.units.every((unit: string) => this.unit_options.some((option) => option.value === unit))
			) {
				this.onUnitsChange(tool_call.function.arguments.units);
			} else {
				console.warn('Invalid Units received:', tool_call.function.arguments.units);
			}
		}
		if (tool_call.function.name === AssistantToolName.MintDatabaseStatesUpdate) {
			if (
				tool_call.function.arguments.states &&
				tool_call.function.arguments.states.every((state: string) => this.state_options.includes(state))
			) {
				this.onStatesChange(tool_call.function.arguments.states);
			} else {
				console.warn('Invalid States received:', tool_call.function.arguments.states);
			}
		}
		if (tool_call.function.name === AssistantToolName.MintBackupFilenameUpdate) {
			if (tool_call.function.arguments.filename) {
				this.form_backup.patchValue({filename: tool_call.function.arguments.filename});
			} else {
				console.warn('Invalid Filename received:', tool_call.function.arguments.filename);
			}
		}
	}

	/* *******************************************************
	   Destruction                      
	******************************************************** */

	ngOnDestroy(): void {
		this.setFormMode(null);
		this.subscriptions.unsubscribe();
	}
}
