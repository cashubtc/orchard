/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	OnDestroy,
	WritableSignal,
	signal,
	ChangeDetectorRef,
	HostListener,
	ViewChild,
	ElementRef,
	AfterViewInit,
	ViewChildren,
	QueryList,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {toObservable} from '@angular/core/rxjs-interop';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription, lastValueFrom, forkJoin} from 'rxjs';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardValidators} from '@client/modules/form/validators';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';
import {NonNullableMintConfigSettings} from '@client/modules/settings/types/setting.types';
import {NavTertiaryItem} from '@client/modules/nav/types/nav-tertiary-item.type';
import {NavTertiaryItemStatus} from '@client/modules/nav/enums/nav-tertiary-item-status.enum';
import {LocalAmountPipe} from '@client/modules/local/pipes/local-amount/local-amount.pipe';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintQuoteTtls} from '@client/modules/mint/classes/mint-quote-ttls.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {Nut15Method, Nut17Commands} from '@client/modules/mint/types/nut.types';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method, AssistantToolName} from '@shared/generated.types';

enum TertiaryNav {
	Nut4 = 'nav4',
	Nut5 = 'nav5',
	Nut7 = 'nav7',
	Nut8 = 'nav8',
	Nut9 = 'nav9',
	Nut10 = 'nav10',
	Nut11 = 'nav11',
	Nut12 = 'nav12',
	Nut14 = 'nav14',
	Nut15 = 'nav15',
	Nut17 = 'nav17',
	Nut19 = 'nav19',
	Nut20 = 'nav20',
	Nut21 = 'nav21',
	Nut22 = 'nav22',
	Nut29 = 'nav29',
}

@Component({
	selector: 'orc-mint-subsection-config',
	standalone: false,
	templateUrl: './mint-subsection-config.component.html',
	styleUrl: './mint-subsection-config.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigComponent implements ComponentCanDeactivate, OnInit, OnDestroy, AfterViewInit {
	@ViewChildren('nav4,nav5,nav7,nav8,nav9,nav10,nav11,nav12,nav14,nav15,nav17,nav19,nav20,nav21,nav22,nav29')
	nav_elements!: QueryList<ElementRef>;
	@ViewChild('nut_container', {static: false}) nut_container!: ElementRef;

	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	public page_settings!: NonNullableMintConfigSettings;
	public mint_info: MintInfo | null = null;
	public quote_ttls!: MintQuoteTtls;
	public minting_units: string[] = [];
	public melting_units: string[] = [];
	public locale!: string;
	public data_loading: boolean = true;
	public mint_quotes: MintMintQuote[] = [];
	public mint_quotes_bolt11: MintMintQuote[] = [];
	public mint_quotes_bolt12: MintMintQuote[] = [];
	public mint_quotes_onchain: MintMintQuote[] = [];
	public melt_quotes: MintMeltQuote[] = [];
	public melt_quotes_bolt11: MintMeltQuote[] = [];
	public melt_quotes_bolt12: MintMeltQuote[] = [];
	public melt_quotes_onchain: MintMeltQuote[] = [];
	public nut15_methods: Nut15Method[] = [];
	public nut17_commands: Nut17Commands[] = [];
	public method_index: string[] = [];
	public form_config: FormGroup = new FormGroup({
		minting: new FormGroup({
			enabled: new FormControl(),
			mint_ttl: new FormControl(null, [Validators.min(0), Validators.max(604800), OrchardValidators.integer]),
		}),
		melting: new FormGroup({
			enabled: new FormControl(),
			melt_ttl: new FormControl(null, [Validators.min(0), Validators.max(604800), OrchardValidators.integer]),
		}),
	});
	public tertiary_nav_revision: number = 0;
	public tertiary_nav_items: Record<TertiaryNav, NavTertiaryItem> = {
		[TertiaryNav.Nut4]: {
			title: 'Minting',
			status: undefined,
		},
		[TertiaryNav.Nut5]: {
			title: 'Melting',
			status: undefined,
		},
		[TertiaryNav.Nut7]: {
			title: 'Token check',
			status: undefined,
		},
		[TertiaryNav.Nut8]: {
			title: 'Lightning fee',
			status: undefined,
		},
		[TertiaryNav.Nut9]: {
			title: 'Restore signatures',
			status: undefined,
		},
		[TertiaryNav.Nut10]: {
			title: 'Spending conditions',
			status: undefined,
		},
		[TertiaryNav.Nut11]: {
			title: 'P2Pk',
			status: undefined,
		},
		[TertiaryNav.Nut12]: {
			title: 'Offline validation',
			status: undefined,
		},
		[TertiaryNav.Nut14]: {
			title: 'HTLCs',
			status: undefined,
		},
		[TertiaryNav.Nut15]: {
			title: 'PMP payments',
			status: undefined,
		},
		[TertiaryNav.Nut17]: {
			title: 'Websockets',
			status: undefined,
		},
		[TertiaryNav.Nut19]: {
			title: 'Cached responses',
			status: undefined,
		},
		[TertiaryNav.Nut20]: {
			title: 'Quote signature',
			status: undefined,
		},
		[TertiaryNav.Nut21]: {
			title: 'Clear auth',
			status: undefined,
		},
		[TertiaryNav.Nut22]: {
			title: 'Blind auth',
			status: undefined,
		},
		[TertiaryNav.Nut29]: {
			title: 'Batched minting',
			status: undefined,
		},
	};

	public get form_minting(): FormGroup {
		return this.form_config.get('minting') as FormGroup;
	}

	public get form_melting(): FormGroup {
		return this.form_config.get('melting') as FormGroup;
	}

	public device_type = signal<DeviceType>('desktop');

	private subscriptions: Subscription = new Subscription();
	private active_event: EventData | null = null;
	private dirty_count: WritableSignal<number> = signal(0);
	private dirty_count$ = toObservable(this.dirty_count);
	private scroll_to: string | null = null;

	constructor(
		private settingAppService: SettingAppService,
		public mintService: MintService,
		public route: ActivatedRoute,
		public eventService: EventService,
		public aiService: AiService,
		public settingDeviceService: SettingDeviceService,
		public breakpointObserver: BreakpointObserver,
		public cdr: ChangeDetectorRef,
		private router: Router,
	) {
		const nav = this.router.currentNavigation();
		this.scroll_to = nav?.extras.state?.['scroll_to'] ?? null;
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	ngOnInit(): void {
		this.page_settings = this.getPageSettings();
		this.mint_info = this.route.snapshot.data['mint_info'];
		this.quote_ttls = this.route.snapshot.data['mint_quote_ttl'];
		this.patchStaticFormElements();
		this.initTertiaryNavStatus();
		this.method_index = this.getMethodIndex();
		this.minting_units = this.getUniqueUnits('nut4');
		this.melting_units = this.getUniqueUnits('nut5');
		this.nut15_methods = this.getNut15Methods();
		this.nut17_commands = this.getNut17Commands();
		this.buildDynamicFormElements();
		this.initChartData();
		Object.keys(this.form_config.controls).forEach((form_group_key) => {
			const form_group = this.form_config.get(form_group_key) as FormGroup;
			if (form_group.get('enabled')?.value === false) form_group.disable();
		});
		this.subscriptions.add(this.getMintInfoSubscription());
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getFormSubscription());
		this.subscriptions.add(this.getDirtyCountSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.orchardOptionalInit();
	}

	ngAfterViewInit(): void {
		this.updateTertiaryNav();
		if (this.scroll_to) setTimeout(() => this.scrollToChart(this.scroll_to as TertiaryNav));
	}

	orchardOptionalInit(): void {
		if (this.settingAppService.getSetting('ai_enabled').value) {
			this.subscriptions.add(this.getAssistantSubscription());
			this.subscriptions.add(this.getToolSubscription());
		}
	}

	private getPageSettings(): NonNullableMintConfigSettings {
		const settings = this.settingDeviceService.getMintConfigSettings();
		return {
			tertiary_nav: settings.tertiary_nav ?? Object.values(TertiaryNav),
		};
	}

	private patchStaticFormElements(): void {
		this.form_config.patchValue({
			minting: {
				enabled: this.translateDisabled(this.mint_info?.nuts.nut4.disabled),
				mint_ttl: this.quote_ttls.mint_ttl,
			},
			melting: {
				enabled: this.translateDisabled(this.mint_info?.nuts.nut5.disabled),
				melt_ttl: this.quote_ttls.melt_ttl,
			},
		});
	}

	private getUniqueUnits(nut: 'nut4' | 'nut5'): string[] {
		const unit_set = new Set<string>();
		this.mint_info?.nuts[nut].methods.forEach((method) => unit_set.add(method.unit));
		return Array.from(unit_set);
	}

	private getNut15Methods(): Nut15Method[] {
		if (!this.mint_info?.nuts.nut15) return [];
		const all_units: string[] = this.mint_info?.nuts.nut15.methods.map((m) => m.unit) || [];
		const units = Array.from(new Set(all_units));
		return units.map((unit) => ({
			unit,
			methods: this.mint_info?.nuts.nut15?.methods?.filter((m) => m.unit === unit).map((m) => m.method) || [],
		}));
	}

	private getNut17Commands(): Nut17Commands[] {
		if (!this.mint_info?.nuts.nut17) return [];
		const all_units: string[] = this.mint_info?.nuts.nut17?.supported?.map((m) => m.unit) || [];
		const units = Array.from(new Set(all_units));
		const nut17_commands: Nut17Commands[] = [];
		units.forEach((unit) => {
			const methods = this.mint_info?.nuts.nut17?.supported?.filter((supp) => supp.unit === unit).map((supp) => supp.method) || [];
			const mcommands = methods.map((method) => {
				return {
					method: method,
					commands: [],
				};
			});
			nut17_commands.push({unit, methods: mcommands});
		});
		nut17_commands.forEach((group) => {
			group.methods.forEach((method) => {
				this.mint_info?.nuts.nut17?.supported
					.filter((supp) => supp.unit === group.unit && supp.method === method.method)
					.forEach((supp) => {
						supp.commands.forEach((command) => {
							method.commands.push(command);
						});
					});
			});
		});
		return nut17_commands;
	}

	private buildDynamicFormElements(): void {
		this.minting_units.forEach((unit) => {
			this.form_minting.addControl(unit, new FormGroup({}));
			this.mint_info?.nuts.nut4.methods
				.filter((method) => method.unit === unit)
				.forEach((method) => {
					const min_validators = [Validators.required, Validators.min(0)];
					method.unit === 'sat' ? min_validators.push(OrchardValidators.integer) : min_validators.push(OrchardValidators.cents);
					const max_validators = [Validators.required, OrchardValidators.minGreaterThan('min_amount')];
					method.unit === 'sat' ? max_validators.push(OrchardValidators.integer) : max_validators.push(OrchardValidators.cents);

					const min_value =
						method.min_amount !== null && method.min_amount !== undefined
							? LocalAmountPipe.getConvertedAmount(unit, method.min_amount)
							: method.min_amount;
					const max_value =
						method.max_amount !== null && method.max_amount !== undefined
							? LocalAmountPipe.getConvertedAmount(unit, method.max_amount)
							: method.max_amount;
					const formatted_min = method.unit === 'sat' ? min_value : Number(min_value ?? 0).toFixed(2);
					const formatted_max = method.unit === 'sat' ? max_value : Number(max_value ?? 0).toFixed(2);

					(this.form_minting.get(unit) as FormGroup).addControl(
						method.method,
						new FormGroup({
							min_amount: new FormControl(formatted_min, min_validators),
							max_amount: new FormControl(formatted_max, max_validators),
							description: new FormControl(method.description),
						}),
					);
				});
		});
		this.melting_units.forEach((unit) => {
			this.form_melting.addControl(unit, new FormGroup({}));
			this.mint_info?.nuts.nut5.methods
				.filter((method) => method.unit === unit)
				.forEach((method) => {
					const min_validators = [Validators.required, Validators.min(0)];
					method.unit === 'sat' ? min_validators.push(OrchardValidators.integer) : min_validators.push(OrchardValidators.cents);
					const max_validators = [Validators.required, OrchardValidators.minGreaterThan('min_amount')];
					method.unit === 'sat' ? max_validators.push(OrchardValidators.integer) : max_validators.push(OrchardValidators.cents);

					const min_value =
						method.min_amount !== null && method.min_amount !== undefined
							? LocalAmountPipe.getConvertedAmount(unit, method.min_amount)
							: method.min_amount;
					const max_value =
						method.max_amount !== null && method.max_amount !== undefined
							? LocalAmountPipe.getConvertedAmount(unit, method.max_amount)
							: method.max_amount;
					const formatted_min = method.unit === 'sat' ? min_value : Number(min_value ?? 0).toFixed(2);
					const formatted_max = method.unit === 'sat' ? max_value : Number(max_value ?? 0).toFixed(2);

					(this.form_melting.get(unit) as FormGroup).addControl(
						method.method,
						new FormGroup({
							min_amount: new FormControl(formatted_min, min_validators),
							max_amount: new FormControl(formatted_max, max_validators),
							amountless: new FormControl({value: method.amountless, disabled: true}),
						}),
					);
				});
		});
	}

	private getMethodIndex(): string[] {
		const method_index: string[] = [];
		this.mint_info?.nuts.nut4.methods.forEach((method) => {
			method_index.push(`nut4:${method.unit}:${method.method}`);
		});
		this.mint_info?.nuts.nut5.methods.forEach((method) => {
			method_index.push(`nut5:${method.unit}:${method.method}`);
		});
		return method_index;
	}

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getMintInfoSubscription(): Subscription {
		return this.mintService.mint_info$.subscribe((info: MintInfo | null) => {
			if (info) this.mint_info = info;
			this.mint_info?.nuts.nut4.disabled ? this.form_minting.disable() : this.form_minting.enable();
			this.mint_info?.nuts.nut5.disabled ? this.form_melting.disable() : this.form_melting.enable();
			this.cdr.detectChanges();
		});
	}

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			const form_value = this.form_config.value;
			let context = `# Mint Configuration\n\n`;
			context += `## Minting\n`;
			context += `* **Enabled:** ${form_value.minting?.enabled ? 'Yes' : 'No'}\n`;
			context += `* **Mint TTL:** ${form_value.minting?.mint_ttl || 'Not set'} seconds\n`;
			if (form_value.minting?.sat?.bolt11) {
				const bolt11 = form_value.minting.sat.bolt11;
				context += `* **SAT/BOLT11:** ${bolt11.min_amount} - ${bolt11.max_amount}\n`;
			}
			context += `## Melting\n`;
			context += `* **Enabled:** ${form_value.melting?.enabled ? 'Yes' : 'No'}\n`;
			context += `* **Melt TTL:** ${form_value.melting?.melt_ttl || 'Not set'} seconds\n`;
			if (form_value.melting?.sat?.bolt11) {
				const bolt11 = form_value.melting.sat.bolt11;
				context += `* **SAT/BOLT11:** ${bolt11.min_amount} - ${bolt11.max_amount}\n`;
			}
			this.aiService.openAiSocket(assistant, content, context);
		});
	}

	private getToolSubscription(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
		});
	}

	private getEventSubscription(): Subscription {
		return this.eventService.getActiveEvent().subscribe((event_data: EventData | null) => {
			this.active_event = event_data;
			if (event_data === null) this.evaluateDirtyCount();
			if (event_data && event_data.confirmed !== null) {
				event_data.confirmed ? this.onConfirmedEvent() : this.onUnconfirmedEvent();
			}
		});
	}

	private getFormSubscription(): Subscription {
		return this.form_config.valueChanges.subscribe(() => {
			this.evaluateDirtyCount();
		});
	}

	private getDirtyCountSubscription(): Subscription {
		return this.dirty_count$.subscribe((count) => {
			this.createPendingEvent(count);
		});
	}

	private getBreakpointSubscription(): Subscription {
		return this.breakpointObserver.observe([Breakpoints.Large, Breakpoints.XLarge]).subscribe((result) => {
			this.device_type.set(result.matches ? 'desktop' : 'tablet');
		});
	}

	/* *******************************************************
		Data                      
	******************************************************** */

	private async initChartData(): Promise<void> {
		this.locale = this.settingDeviceService.getLocale();
		await this.loadChartData();
		this.data_loading = false;
		this.cdr.detectChanges();
	}

	private async loadChartData(): Promise<void> {
		const mint_quotes_obs = this.mintService.loadMintMintQuotes();
		const melt_quotes_obs = this.mintService.loadMintMeltQuotes();

		const [mint_quotes, melt_quotes] = await lastValueFrom(forkJoin([mint_quotes_obs, melt_quotes_obs]));
		this.mint_quotes = mint_quotes;
		this.mint_quotes_bolt11 = mint_quotes.filter((quote) => quote.payment_method === 'bolt11');
		this.mint_quotes_bolt12 = mint_quotes.filter((quote) => quote.payment_method === 'bolt12');
		this.mint_quotes_onchain = mint_quotes.filter((quote) => quote.payment_method === 'onchain');
		this.melt_quotes = melt_quotes;
		this.melt_quotes_bolt11 = melt_quotes.filter((quote) => quote.payment_method === 'bolt11');
		this.melt_quotes_bolt12 = melt_quotes.filter((quote) => quote.payment_method === 'bolt12');
		this.melt_quotes_onchain = melt_quotes.filter((quote) => quote.payment_method === 'onchain');
	}

	/* *******************************************************
		Form                      
	******************************************************** */

	private evaluateDirtyCount(): void {
		let count = 0;
		this.dirty_count.set(count);

		const countDirtyControls = (group: FormGroup): number => {
			return Object.keys(group.controls).reduce((acc, key) => {
				const control = group.get(key);
				if (control instanceof FormGroup) return acc + countDirtyControls(control);
				return acc + (control?.dirty ? 1 : 0);
			}, 0);
		};

		count = countDirtyControls(this.form_config);
		this.dirty_count.set(count);
		this.cdr.detectChanges();
	}

	private translateDisabled(status: boolean | undefined): boolean {
		if (status === undefined) return false;
		return !status;
	}

	private createPendingEvent(count: number): void {
		if (this.active_event?.type === 'SAVING') return;
		if (count === 0 && this.active_event?.type !== 'PENDING') return;
		if (count === 0) return this.eventService.registerEvent(null);
		const message = count === 1 ? '1 update' : `${count} updates`;
		this.eventService.registerEvent(
			new EventData({
				type: 'PENDING',
				message: message,
			}),
		);
	}

	public onEnabledUpdate({form_group, nut}: {form_group: FormGroup; nut: 'nut4' | 'nut5'}): void {
		if (form_group.get('enabled')?.invalid) return;
		form_group.get('enabled')?.markAsPristine();
		const control_value = this.translateDisabled(form_group.get('enabled')?.value);
		control_value ? form_group.disable() : form_group.enable();
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		const unit = this.mint_info?.nuts[nut].methods[0].unit;
		const method = this.mint_info?.nuts[nut].methods[0].method;
		if (!unit || !method)
			return this.eventService.registerEvent(
				new EventData({
					type: 'ERROR',
					message: 'No unit or method found',
				}),
			);
		if (nut === 'nut4') this.updateMintNut04(unit, method, 'disabled', control_value);
		if (nut === 'nut5') this.updateMintNut05(unit, method, 'disabled', control_value);
		this.updateTertiaryNavStatus();
	}

	public onTtlCancel({form_group, control_name}: {form_group: FormGroup; control_name: keyof MintQuoteTtls}): void {
		if (!control_name) return;
		form_group.get(control_name)?.markAsPristine();
		form_group.get(control_name)?.setValue(this.quote_ttls[control_name]);
	}

	public onTtlUpdate({form_group, control_name}: {form_group: FormGroup; control_name: keyof MintQuoteTtls}): void {
		if (!control_name) return;
		if (form_group.get(control_name)?.invalid) return;
		form_group.get(control_name)?.markAsPristine();
		const control_value = form_group.get(control_name)?.value;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.updateMintTtl(control_name, control_value);
	}

	public onMethodUpdate({
		nut,
		unit,
		method,
		form_group,
		control_name,
	}: {
		nut: 'nut4' | 'nut5';
		unit: string;
		method: string;
		form_group: FormGroup;
		control_name: keyof OrchardNut4Method | keyof OrchardNut5Method;
	}): void {
		if (!control_name) return;
		if (form_group.get(unit)?.get(method)?.get(control_name)?.invalid) return;
		form_group.get(unit)?.get(method)?.get(control_name)?.markAsPristine();
		const control_value = form_group.get(unit)?.get(method)?.get(control_name)?.value;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (nut === 'nut4') this.updateMintNut04(unit, method, control_name as keyof OrchardNut4Method, control_value);
		if (nut === 'nut5') this.updateMintNut05(unit, method, control_name as keyof OrchardNut5Method, control_value);
	}

	public onMethodCancel({
		nut,
		unit,
		method,
		form_group,
		control_name,
	}: {
		nut: 'nut4' | 'nut5';
		unit: string;
		method: string;
		form_group: FormGroup;
		control_name: keyof OrchardNut4Method | keyof OrchardNut5Method;
	}): void {
		form_group.get(unit)?.get(method)?.get(control_name)?.markAsPristine();
		const nut_method = this.mint_info?.nuts[nut].methods.find((nut_method) => nut_method.unit === unit && nut_method.method === method);
		const raw_val =
			nut === 'nut4'
				? (nut_method as OrchardNut4Method)?.[control_name as keyof OrchardNut4Method]
				: (nut_method as OrchardNut5Method)?.[control_name as keyof OrchardNut5Method];
		const converted_val =
			raw_val !== null && raw_val !== undefined && typeof raw_val === 'number'
				? LocalAmountPipe.getConvertedAmount(unit, raw_val)
				: raw_val;
		const formatted_val = unit === 'sat' || typeof converted_val !== 'number' ? converted_val : Number(converted_val).toFixed(2);
		form_group.get(unit)?.get(method)?.get(control_name)?.setValue(formatted_val);
	}

	private onUnconfirmedEvent(): void {
		this.onTtlCancel({
			form_group: this.form_minting,
			control_name: 'mint_ttl',
		});
		this.onTtlCancel({
			form_group: this.form_melting,
			control_name: 'melt_ttl',
		});
		this.minting_units.forEach((unit) => {
			this.mint_info?.nuts.nut4.methods.forEach((method) => {
				this.onMethodCancel({
					nut: 'nut4',
					unit: unit,
					method: method.method,
					form_group: this.form_minting,
					control_name: 'min_amount',
				});
				this.onMethodCancel({
					nut: 'nut4',
					unit: unit,
					method: method.method,
					form_group: this.form_minting,
					control_name: 'max_amount',
				});
			});
		});
		this.melting_units.forEach((unit) => {
			this.mint_info?.nuts.nut5.methods.forEach((method) => {
				this.onMethodCancel({
					nut: 'nut5',
					unit: unit,
					method: method.method,
					form_group: this.form_melting,
					control_name: 'min_amount',
				});
				this.onMethodCancel({
					nut: 'nut5',
					unit: unit,
					method: method.method,
					form_group: this.form_melting,
					control_name: 'max_amount',
				});
			});
		});
	}

	private onConfirmedEvent(): void {
		if (this.form_config.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid config',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		const mutation_parts: string[] = [];
		const mutation_types: Record<string, string> = {};
		const mutation_values: Record<string, any> = {};
		const ttl_updates: Record<string, number | null> = {};

		if (this.form_minting.get('mint_ttl')?.dirty) ttl_updates['mint_ttl'] = this.form_minting.get('mint_ttl')?.value;
		if (this.form_melting.get('melt_ttl')?.dirty) ttl_updates['melt_ttl'] = this.form_melting.get('melt_ttl')?.value;

		if (Object.keys(ttl_updates).length > 0) {
			mutation_parts.push(`
				mint_quote_ttl_update(mint_quote_ttl_update: $ttl_update) {
					mint_ttl
					melt_ttl
				}
			`);
			mutation_types['ttl_update'] = 'MintQuoteTtlUpdateInput!';
			mutation_values['ttl_update'] = ttl_updates;
		}

		this.minting_units.forEach((unit) => {
			const unit_group = this.form_minting.get(unit) as FormGroup;
			if (!unit_group) return;
			Object.keys(unit_group.controls).forEach((method) => {
				const method_group = unit_group.get(method) as FormGroup;
				if (!method_group) return;
				const method_update: Record<string, any> = {unit, method};
				if (this.form_minting.get('enabled')?.dirty)
					method_update['disabled'] = this.translateDisabled(this.form_minting.get('enabled')?.value);
				if (method_group.get('min_amount')?.dirty) method_update['min_amount'] = method_group.get('min_amount')?.value;
				if (method_group.get('max_amount')?.dirty) method_update['max_amount'] = method_group.get('max_amount')?.value;
				if (method_group.get('description')?.dirty) method_update['description'] = method_group.get('description')?.value;
				if (Object.keys(method_update).length > 2) {
					const var_prefix = `nut04_${unit}_${method}`;
					const field_type_map: Record<string, string> = {
						unit: 'String!',
						method: 'String!',
						disabled: 'Boolean',
						min_amount: 'Int',
						max_amount: 'Int',
						description: 'Boolean',
					};
					const args_list: string[] = [];
					for (const [field, value] of Object.entries(method_update)) {
						const var_name = `${var_prefix}_${field}`;
						mutation_types[var_name] = field_type_map[field];
						mutation_values[var_name] = value;
						args_list.push(`${field}: $${var_name}`);
					}
					mutation_parts.push(`
						mint_nut04_update_${unit}_${method}: mint_nut04_update(${args_list.join(', ')}) {
							unit
							method
							max_amount
							min_amount
							description
							disabled
						}
					`);
				}
			});
		});

		this.melting_units.forEach((unit) => {
			const unit_group = this.form_melting.get(unit) as FormGroup;
			if (!unit_group) return;
			Object.keys(unit_group.controls).forEach((method) => {
				const method_group = unit_group.get(method) as FormGroup;
				if (!method_group) return;
				const method_update: Record<string, any> = {unit, method};
				if (this.form_melting.get('enabled')?.dirty)
					method_update['disabled'] = this.translateDisabled(this.form_melting.get('enabled')?.value);
				if (method_group.get('min_amount')?.dirty) method_update['min_amount'] = method_group.get('min_amount')?.value;
				if (method_group.get('max_amount')?.dirty) method_update['max_amount'] = method_group.get('max_amount')?.value;
				if (Object.keys(method_update).length > 2) {
					const var_prefix = `nut05_${unit}_${method}`;
					const field_type_map: Record<string, string> = {
						unit: 'String!',
						method: 'String!',
						disabled: 'Boolean',
						min_amount: 'Int',
						max_amount: 'Int',
					};
					const args_list: string[] = [];
					for (const [field, value] of Object.entries(method_update)) {
						const var_name = `${var_prefix}_${field}`;
						mutation_types[var_name] = field_type_map[field];
						mutation_values[var_name] = value;
						args_list.push(`${field}: $${var_name}`);
					}
					mutation_parts.push(`
						mint_nut05_update_${unit}_${method}: mint_nut05_update(${args_list.join(', ')}) {
							unit
							method
							max_amount
							min_amount
							disabled
						}
					`);
				}
			});
		});

		if (mutation_parts.length === 0) return;

		const mutation = `
			mutation BulkMintUpdate(${Object.entries(mutation_types)
				.map(([key, type]) => `$${key}: ${type}`)
				.join(',\n            ')}) {
				${mutation_parts.join('\n')}
			}
		`;

		this.mintService.updateMint(mutation, mutation_values).subscribe({
			next: () => {
				this.mintService.clearInfoCache();
				this.mintService.loadMintInfo().subscribe();
				this.mintService.getMintQuoteTtls().subscribe((quote_ttls: MintQuoteTtls) => {
					this.quote_ttls = quote_ttls;
					this.cdr.detectChanges();
				});
				this.onSuccess(true);
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintTtl(control_name: keyof MintQuoteTtls, control_value: any): void {
		this.mintService.updateMintQuoteTtl(control_name, control_value).subscribe({
			next: (response) => {
				this.quote_ttls[control_name] = response.mint_quote_ttl_update[control_name] ?? null;
				this.onSuccess();
				this.form_config.get(control_name)?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintNut04(unit: string, method: string, control_name: keyof OrchardNut4Method | 'disabled', control_value: any): void {
		this.mintService.updateMintNut04(unit, method, control_name, control_value).subscribe({
			next: () => {
				const nut_method = this.mint_info?.nuts.nut4.methods.find(
					(nut_method) => nut_method.unit === unit && nut_method.method === method,
				);
				if (nut_method) (nut_method as any)[control_name] = control_value;
				if (control_name === 'disabled' && this.mint_info) this.mint_info.nuts.nut4.disabled = control_value;
				this.cdr.detectChanges();
				this.onSuccess();
				this.form_config.get(control_name)?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintNut05(unit: string, method: string, control_name: keyof OrchardNut5Method | 'disabled', control_value: any): void {
		this.mintService.updateMintNut05(unit, method, control_name, control_value).subscribe({
			next: () => {
				const nut_method = this.mint_info?.nuts.nut5.methods.find(
					(nut_method) => nut_method.unit === unit && nut_method.method === method,
				);
				if (nut_method) (nut_method as any)[control_name] = control_value;
				if (control_name === 'disabled' && this.mint_info) this.mint_info.nuts.nut5.disabled = control_value;
				this.cdr.detectChanges();
				this.onSuccess();
				this.form_config.get(control_name)?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private onSuccess(reset: boolean = false): void {
		this.eventService.registerEvent(
			new EventData({
				type: 'SUCCESS',
				message: 'Configuration updated!',
			}),
		);
		if (!reset) return;
		this.form_config.markAsPristine();
		this.dirty_count.set(0);
	}

	private onError(errors: OrchardErrors): void {
		this.eventService.registerEvent(
			new EventData({
				type: 'ERROR',
				message: errors.errors[0].getFullError(),
			}),
		);
	}

	/* *******************************************************
		AI                      
	******************************************************** */

	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		if (tool_call.function.name === AssistantToolName.MintEnabledUpdate) {
			const operation = tool_call.function.arguments.operation;
			const enabled = tool_call.function.arguments.enabled;
			const form_group = operation === 'minting' ? this.form_minting : this.form_melting;
			if (!form_group) return;
			form_group.get('enabled')?.markAsDirty();
			form_group.get('enabled')?.setValue(enabled);
		}
		if (tool_call.function.name === AssistantToolName.MintQuoteTtlUpdate) {
			const operation = tool_call.function.arguments.operation;
			const ttl = tool_call.function.arguments.ttl;
			const form_control = operation === 'minting' ? this.form_minting.get('mint_ttl') : this.form_melting.get('melt_ttl');
			if (!form_control) return;
			form_control?.markAsDirty();
			form_control?.setValue(ttl);
		}
		if (tool_call.function.name === AssistantToolName.MintMethodMinUpdate) {
			const operation = tool_call.function.arguments.operation;
			const method = tool_call.function.arguments.method;
			const unit = tool_call.function.arguments.unit;
			const min_amount = tool_call.function.arguments.min_amount;
			const form_group = operation === 'minting' ? this.form_minting : this.form_melting;
			const form_control = form_group.get(unit)?.get(method)?.get('min_amount');
			if (!form_control) return;
			form_control?.markAsDirty();
			form_control?.setValue(min_amount);
		}
		if (tool_call.function.name === AssistantToolName.MintMethodMaxUpdate) {
			const operation = tool_call.function.arguments.operation;
			const method = tool_call.function.arguments.method;
			const unit = tool_call.function.arguments.unit;
			const max_amount = tool_call.function.arguments.max_amount;
			const form_group = operation === 'minting' ? this.form_minting : this.form_melting;
			const form_control = form_group.get(unit)?.get(method)?.get('max_amount');
			if (!form_control) return;
			form_control?.markAsDirty();
			form_control?.setValue(max_amount);
		}
		if (tool_call.function.name === AssistantToolName.MintMethodDescriptionUpdate) {
			const method = tool_call.function.arguments.method;
			const unit = tool_call.function.arguments.unit;
			const description = tool_call.function.arguments.description;
			const form_control = this.form_minting.get(unit)?.get(method)?.get('description');
			if (!form_control) return;
			form_control.markAsDirty();
			if (typeof description === 'string') return form_control.setValue(JSON.parse((description as string).toLowerCase()));
			form_control.setValue(description);
		}
		this.evaluateDirtyCount();
		this.cdr.detectChanges();
	}

	/* *******************************************************
		Tertiary Nav                      
	******************************************************** */

	public onTertiaryNavChange(event: string[]): void {
		this.page_settings.tertiary_nav = event;
		this.settingDeviceService.setMintConfigSettings(this.page_settings);
		this.updateTertiaryNav();
	}

	public onTertiaryNavSelect(event: string): void {
		this.scrollToChart(event as TertiaryNav);
	}

	private scrollToChart(nav_item: TertiaryNav) {
		const target_element = this.nav_elements.find((el) => el.nativeElement.classList.contains(nav_item));
		if (!target_element?.nativeElement) return;
		target_element.nativeElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
			inline: 'nearest',
		});
	}

	private updateTertiaryNav(): void {
		const tertiary_nav = this.page_settings.tertiary_nav.map((area) => `"${area}"`).join(' ');
		this.nut_container.nativeElement.style.gridTemplateAreas = `${tertiary_nav}`;
	}

	private initTertiaryNavStatus(): void {
		this.updateTertiaryNavStatus();
		this.setNavItemStatus(TertiaryNav.Nut7, this.mint_info?.nuts.nut7?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut8, this.mint_info?.nuts.nut8?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut9, this.mint_info?.nuts.nut9?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut10, this.mint_info?.nuts.nut10?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut11, this.mint_info?.nuts.nut11?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut12, this.mint_info?.nuts.nut12?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut14, this.mint_info?.nuts?.nut14?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut15, this.mint_info?.nuts?.nut15?.methods?.length === 0 ? false : true);
		this.setNavItemStatus(TertiaryNav.Nut17, this.mint_info?.nuts?.nut17?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut19, this.mint_info?.nuts?.nut19 ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut20, this.mint_info?.nuts?.nut20?.supported ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut21, this.mint_info?.nuts?.nut21 ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut22, this.mint_info?.nuts?.nut22 ? true : false);
		this.setNavItemStatus(TertiaryNav.Nut29, this.mint_info?.nuts?.nut29 ? true : false);
	}

	private updateTertiaryNavStatus(): void {
		this.setNavItemStatus(TertiaryNav.Nut4, this.form_minting.get('enabled')?.value);
		this.setNavItemStatus(TertiaryNav.Nut5, this.form_melting.get('enabled')?.value);
		this.tertiary_nav_revision++;
	}

	private setNavItemStatus(nav_key: TertiaryNav, condition: boolean): void {
		this.tertiary_nav_items[nav_key].status = condition ? NavTertiaryItemStatus.Enabled : NavTertiaryItemStatus.Disabled;
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
