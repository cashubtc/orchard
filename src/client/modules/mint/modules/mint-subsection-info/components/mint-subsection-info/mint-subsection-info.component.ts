/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, OnDestroy, ChangeDetectorRef, signal, HostListener} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {FormGroup, FormControl, Validators, FormArray} from '@angular/forms';
import {toObservable} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintInfoRpc} from '@client/modules/mint/classes/mint-info-rpc.class';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Shared Dependencies */
import {AssistantToolName, OrchardContact} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-info',
	standalone: false,
	templateUrl: './mint-subsection-info.component.html',
	styleUrl: './mint-subsection-info.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionInfoComponent implements ComponentCanDeactivate, OnInit, OnDestroy {
	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	public init_info!: MintInfoRpc;
	public form_info: FormGroup = new FormGroup({
		name: new FormControl(null, Validators.maxLength(200)),
		description: new FormControl(),
		icon_url: new FormControl(),
		description_long: new FormControl(),
		motd: new FormControl(),
		urls: new FormArray([]),
		contact: new FormArray([]),
	});
	public focus_control: string | null = null;

	public get form_array_urls(): FormArray {
		return this.form_info.get('urls') as FormArray;
	}

	public get form_array_contacts(): FormArray {
		return this.form_info.get('contact') as FormArray;
	}

	public device_type = signal<DeviceType>('desktop');

	private subscriptions: Subscription = new Subscription();
	private active_event: EventData | null = null;
	private dirty_count = signal<number>(0);
	private dirty_count$ = toObservable(this.dirty_count);

	constructor(
		private configService: ConfigService,
		private settingAppService: SettingAppService,
		public mintService: MintService,
		public route: ActivatedRoute,
		public aiService: AiService,
		public eventService: EventService,
		public breakpointObserver: BreakpointObserver,
		public cdr: ChangeDetectorRef,
		public router: Router,
	) {
		const nav = this.router.currentNavigation();
		this.focus_control = nav?.extras.state?.['focus_control'];
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	async ngOnInit(): Promise<void> {
		this.init_info = this.route.snapshot.data['mint_info_rpc'];
		this.form_info.patchValue({
			name: this.init_info.name,
			description: this.init_info.description,
			icon_url: this.init_info.icon_url,
			description_long: this.init_info.description_long,
			motd: this.init_info.motd,
		});
		if (this.init_info.urls && Array.isArray(this.init_info.urls)) {
			const url_controls = this.init_info.urls.map((url) => new FormControl(url, [Validators.required]));
			url_controls.forEach((control) => this.form_array_urls.push(control));
		}
		if (this.init_info.contact && Array.isArray(this.init_info.contact)) {
			const contact_controls = this.init_info.contact.map(
				(contact) =>
					new FormGroup({
						method: new FormControl(contact.method, [Validators.required]),
						info: new FormControl(contact.info, [Validators.required]),
					}),
			);
			contact_controls.forEach((control) => this.form_array_contacts.push(control));
		}
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getFormSubscription());
		this.subscriptions.add(this.getDirtyCountSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.orchardOptionalInit();
	}

	orchardOptionalInit(): void {
		if (this.settingAppService.getSetting('ai_enabled').value) {
			this.subscriptions.add(this.getAssistantSubscription());
			this.subscriptions.add(this.getToolSubscription());
		}
	}

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			const form_value = this.form_info.value;
			let context = `* **Name:** ${form_value.name || 'Not set'}\n`;
			context += `* **Description:** ${form_value.description || 'Not set'}\n`;
			context += `* **Long Description:** ${form_value.description_long || 'Not set'}\n`;
			context += `* **Icon URL:** ${form_value.icon_url || 'Not set'}\n`;
			context += `* **Message of the Day:** ${form_value.motd || 'Not set'}\n`;
			context += `* **URLs:**\n`;
			if (form_value.urls && form_value.urls.length > 0) {
				form_value.urls.forEach((url: string) => {
					context += `  * ${url}\n`;
				});
			} else {
				context += `  * No URLs configured\n`;
			}
			context += `* **Contacts:**\n`;
			if (form_value.contact && form_value.contact.length > 0) {
				form_value.contact.forEach((contact: any) => {
					context += `  * ${contact.method}: ${contact.info}\n`;
				});
			} else {
				context += `  * No contacts configured\n`;
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
		return this.form_info.valueChanges.subscribe(() => {
			this.evaluateDirtyCount();
		});
	}

	private getDirtyCountSubscription(): Subscription {
		return this.dirty_count$.subscribe((count) => {
			this.createPendingEvent(count);
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
		Form                      
	******************************************************** */

	private evaluateDirtyCount(): void {
		this.dirty_count.set(0);
		const contrtol_count = Object.keys(this.form_info.controls)
			.filter((key) => this.form_info.get(key) instanceof FormControl)
			.filter((key) => this.form_info.get(key)?.dirty).length;
		const array_dirty_total = Object.keys(this.form_info.controls)
			.filter((key) => this.form_info.get(key) instanceof FormArray)
			.reduce((total, key) => {
				const array_group = this.form_info.get(key) as FormArray;
				return total + array_group.controls.filter((control) => control.dirty).length;
			}, 0);

		this.dirty_count.set(contrtol_count + array_dirty_total);
		this.cdr.detectChanges();
	}

	private createPendingEvent(count: number): void {
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

	private onUnconfirmedEvent(): void {
		Object.keys(this.form_info.controls).forEach((key) => {
			const control = this.form_info.get(key);
			if (control instanceof FormArray) {
				if (key === 'urls' && this.form_array_urls.dirty) {
					for (let i = this.form_array_urls.length - 1; i >= 0; i--) {
						if (i >= this.init_info.urls.length) {
							this.onArrayControlRemove({array_name: 'urls', control_index: i});
						} else if (this.form_array_urls.at(i).dirty) {
							this.onArrayControlCancel({array_name: 'urls', control_index: i});
						}
					}
					this.form_array_urls.markAsPristine();
				} else if (key === 'contact' && this.form_array_contacts.dirty) {
					for (let i = this.form_array_contacts.length - 1; i >= 0; i--) {
						if (i >= this.init_info.contact.length) {
							this.onArrayControlRemove({array_name: 'contact', control_index: i});
						} else if (this.form_array_contacts.at(i).dirty) {
							this.onArrayControlCancel({array_name: 'contact', control_index: i});
						}
					}
					this.form_array_contacts.markAsPristine();
				}
			} else if (control?.dirty) {
				this.onControlCancel(key as keyof MintInfoRpc);
			}
		});
	}

	private onConfirmedEvent(): void {
		if (this.form_info.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid info',
				}),
			);
		}
		const mutation_parts: string[] = [];
		const mutation_variables: Record<string, any> = {};
		if (this.form_info.get('name')?.dirty) {
			mutation_parts.push(`
				mint_name_update(name: $name) {
					name
				}
			`);
			mutation_variables['name'] = this.form_info.get('name')?.value;
		}
		if (this.form_info.get('description')?.dirty) {
			mutation_parts.push(`
				mint_short_description_update(description: $description) {
					description
				}
			`);
			mutation_variables['description'] = this.form_info.get('description')?.value;
		}
		if (this.form_info.get('description_long')?.dirty) {
			mutation_parts.push(`
				mint_long_description_update(description: $description_long) {
					description
				}
			`);
			mutation_variables['description_long'] = this.form_info.get('description_long')?.value;
		}
		if (this.form_info.get('icon_url')?.dirty) {
			mutation_parts.push(`
				mint_icon_update(icon_url: $icon_url) {
					icon_url
				}
			`);
			mutation_variables['icon_url'] = this.form_info.get('icon_url')?.value;
		}
		if (this.form_info.get('motd')?.dirty) {
			mutation_parts.push(`
				mint_motd_update(motd: $motd) {
					motd
				}
			`);
			mutation_variables['motd'] = this.form_info.get('motd')?.value;
		}

		const urls_array = this.form_info.get('urls') as FormArray;
		if (urls_array?.dirty) {
			const new_urls = urls_array.value.filter(Boolean);
			const old_urls = this.init_info.urls || [];
			const urls_to_remove = old_urls.filter((url) => !new_urls.includes(url));
			urls_to_remove.forEach((url: string, index: number) => {
				const mutation_var = `url_remove_${index}`;
				mutation_parts.push(`
					url_remove_${index}: mint_url_remove(url: $${mutation_var}) {
						url
					}
				`);
				mutation_variables[`${mutation_var}`] = url;
			});
			const urls_to_add = new_urls.filter((url: string) => !old_urls.includes(url));
			urls_to_add.forEach((url: string, index: number) => {
				const mutation_var = `url_add_${index}`;
				mutation_parts.push(`
					url_add_${index}: mint_url_add(url: $${mutation_var}) {
						url
					}
				`);
				mutation_variables[`${mutation_var}`] = url;
			});
		}

		const contacts_array = this.form_info.get('contact') as FormArray;
		if (contacts_array?.dirty) {
			const new_contacts = contacts_array.value.filter((c: OrchardContact) => c.method && c.info);
			const old_contacts = this.init_info.contact || [];
			const contacts_to_remove = old_contacts.filter(
				(old) => !new_contacts.some((contact: OrchardContact) => contact.method === old.method && contact.info === old.info),
			);
			contacts_to_remove.forEach((contact: OrchardContact, index: number) => {
				const mutation_var = `contact_remove_${index}`;
				mutation_parts.push(`
					contact_remove_${index}: mint_contact_remove(method: $${mutation_var}_method, info: $${mutation_var}_info) {
						method
						info
					}
				`);
				mutation_variables[`${mutation_var}_method`] = contact.method;
				mutation_variables[`${mutation_var}_info`] = contact.info;
			});
			const contacts_to_add = new_contacts.filter(
				(contact: OrchardContact) => !old_contacts.some((old) => old.method === contact.method && old.info === contact.info),
			);
			contacts_to_add.forEach((contact: OrchardContact, index: number) => {
				const mutation_var = `contact_add_${index}`;
				mutation_parts.push(`
					contact_add_${index}: mint_contact_add(method: $${mutation_var}_method, info: $${mutation_var}_info) {
						method
						info
					}
				`);
				mutation_variables[`${mutation_var}_method`] = contact.method;
				mutation_variables[`${mutation_var}_info`] = contact.info;
			});
		}

		if (mutation_parts.length === 0) return;
		if (this.hasDuplicateContactMethods()) return;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));

		const mutation = `
			mutation BulkMintUpdate(${Object.keys(mutation_variables)
				.map((key) => `$${key}: String!`)
				.join(', ')}) {
				${mutation_parts.join('\n')}
			}
		`;

		this.mintService.updateMint(mutation, mutation_variables).subscribe({
			next: () => {
				this.mintService.getMintInfo().subscribe((mint_info: MintInfoRpc) => {
					this.init_info = mint_info;
					this.cdr.detectChanges();
				});
				this.onSuccess(true);
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintName(control_value: string): void {
		this.mintService.updateMintName(control_value).subscribe({
			next: (response) => {
				this.init_info.name = response.mint_name_update.name ?? null;
				this.onSuccess();
				this.form_info.get('name')?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintDescription(control_value: string): void {
		this.mintService.updateMintDescription(control_value).subscribe({
			next: (response) => {
				this.init_info.description = response.mint_short_description_update.description ?? null;
				this.onSuccess();
				this.form_info.get('description')?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintIcon(control_value: string): void {
		this.mintService.updateMintIcon(control_value).subscribe({
			next: (response) => {
				this.init_info.icon_url = response.mint_icon_update.icon_url ?? null;
				this.onSuccess();
				this.form_info.get('icon_url')?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintDescriptionLong(control_value: string): void {
		this.mintService.updateMintDescriptionLong(control_value).subscribe({
			next: (response) => {
				this.init_info.description_long = response.mint_long_description_update.description ?? null;
				this.onSuccess();
				this.form_info.get('description_long')?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintMotd(control_value: string): void {
		this.mintService.updateMintMotd(control_value).subscribe({
			next: (response) => {
				this.init_info.motd = response.mint_motd_update.motd ?? null;
				this.onSuccess();
				this.form_info.get('motd')?.markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private addMintUrl(control_value: string): void {
		this.mintService.addMintUrl(control_value).subscribe({
			next: (response) => {
				this.init_info.urls.push(response.mint_url_add.url ?? null);
				this.onSuccess();
				this.form_array_urls.at(-1).markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintUrl(control_index: number, control_value: string, original_value: string): void {
		this.mintService.updateMintUrl(control_value, original_value).subscribe({
			next: (response) => {
				this.init_info.urls[control_index] = response.mint_url_add.url ?? null;
				this.onSuccess();
				this.form_array_urls.at(control_index).markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private removeMintUrl(control_index: number, control_value: string): void {
		this.mintService.removeMintUrl(control_value).subscribe({
			next: () => {
				this.init_info.urls.splice(control_index, 1);
				this.form_array_urls.removeAt(control_index);
				this.onSuccess();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private addMintContact(control_value: OrchardContact): void {
		if (this.hasDuplicateContactMethods()) return;
		this.mintService.addMintContact(control_value).subscribe({
			next: (response) => {
				const contact = response.mint_contact_add;
				this.init_info.contact.push({
					method: contact.method,
					info: contact.info,
				});
				this.onSuccess();
				this.form_array_contacts.at(-1).markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private updateMintContact(control_index: number, control_value: OrchardContact, original_value: OrchardContact): void {
		if (this.hasDuplicateContactMethods()) return;
		this.mintService.updateMintContact(control_value, original_value).subscribe({
			next: (response) => {
				const contact = response.mint_contact_add;
				this.init_info.contact[control_index] = {
					method: contact.method,
					info: contact.info,
				};
				this.onSuccess();
				this.form_array_contacts.at(control_index).markAsPristine();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private removeMintContact(control_index: number, control_value: OrchardContact): void {
		this.mintService.removeMintContact(control_value).subscribe({
			next: () => {
				this.init_info.contact.splice(control_index, 1);
				this.form_array_contacts.removeAt(control_index);
				this.onSuccess();
			},
			error: (error: OrchardErrors) => {
				this.onError(error);
			},
		});
	}

	private onSuccess(reset: boolean = false): void {
		this.mintService.clearInfoCache();
		this.mintService.loadMintInfo().subscribe();
		this.eventService.registerEvent(
			new EventData({
				type: 'SUCCESS',
				message: 'Information updated!',
			}),
		);
		if (!reset) return;
		this.form_info.markAsPristine();
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

	/**
	 * Checks if there are duplicate contact methods in the form array
	 * @returns true if duplicates exist (and shows error), false otherwise
	 */
	private hasDuplicateContactMethods(): boolean {
		const contact_methods = this.form_array_contacts.controls.map((control) => control.get('method')?.value);
		const duplicate_methods = contact_methods.filter((method, index) => contact_methods.indexOf(method) !== index);
		if (duplicate_methods.length > 0) {
			this.eventService.registerEvent(
				new EventData({
					type: 'ERROR',
					message: `Contact method already set: ${duplicate_methods[0]}`,
				}),
			);
			return true;
		}
		return false;
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	public onAddUrlControl(url: string | null = null): void {
		this.form_array_urls.push(new FormControl(url, [Validators.required]));
		this.form_array_urls.at(-1).markAsDirty();
		this.evaluateDirtyCount();
	}

	public onAddContactControl(method: string | null = null, info: string | null = null): void {
		this.form_array_contacts.push(
			new FormGroup({
				method: new FormControl(method, [Validators.required]),
				info: new FormControl(info, [Validators.required]),
			}),
		);
		this.form_array_contacts.at(-1).markAsDirty();
		this.evaluateDirtyCount();
	}

	public onControlUpdate(control_name: keyof MintInfoRpc): void {
		if (this.form_info.get(control_name)?.invalid) return;
		this.form_info.get(control_name)?.markAsPristine();
		const control_value = this.form_info.get(control_name)?.value;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (control_name === 'name') return this.updateMintName(control_value);
		if (control_name === 'description') return this.updateMintDescription(control_value);
		if (control_name === 'description_long') return this.updateMintDescriptionLong(control_value);
		if (control_name === 'icon_url') return this.updateMintIcon(control_value);
		if (control_name === 'motd') return this.updateMintMotd(control_value);
	}

	public onArrayControlUpdate({array_name, control_index}: {array_name: keyof MintInfoRpc; control_index: number}): void {
		const array_group = this.form_info.get(array_name) as FormArray;
		if (array_group.at(control_index).invalid) return;
		array_group.at(control_index).markAsPristine();
		const original_value =
			this.init_info[array_name] && Array.isArray(this.init_info[array_name]) ? this.init_info[array_name][control_index] : null;
		const control_value = array_group.at(control_index).value;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (array_name === 'urls') {
			if (original_value) return this.updateMintUrl(control_index, control_value, original_value);
			return this.addMintUrl(control_value);
		}
		if (array_name === 'contact') {
			if (original_value) return this.updateMintContact(control_index, control_value, original_value);
			return this.addMintContact(control_value);
		}
	}

	public onArrayControlRemove({array_name, control_index}: {array_name: keyof MintInfoRpc; control_index: number}): void {
		const array_group = this.form_info.get(array_name) as FormArray;
		const control_value = array_group.at(control_index).value;
		const original_value =
			this.init_info[array_name] && Array.isArray(this.init_info[array_name]) ? this.init_info[array_name][control_index] : null;
		if (!original_value) {
			array_group.at(control_index).markAsPristine();
			array_group.removeAt(control_index);
			return;
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (array_name === 'urls') return this.removeMintUrl(control_index, control_value);
		if (array_name === 'contact') return this.removeMintContact(control_index, control_value);
	}

	public onControlCancel(control_name: keyof MintInfoRpc): void {
		if (!control_name) return;
		this.form_info.get(control_name)?.markAsPristine();
		this.form_info.get(control_name)?.setValue(this.init_info[control_name]);
	}

	public onArrayControlCancel({array_name, control_index}: {array_name: keyof MintInfoRpc; control_index: number}): void {
		if (!array_name) return;
		const array_group = this.form_info.get(array_name) as FormArray;
		const original_value =
			this.init_info[array_name] && Array.isArray(this.init_info[array_name]) ? this.init_info[array_name][control_index] : null;
		array_group.at(control_index).markAsPristine();
		array_group.at(control_index).setValue(original_value);
	}

	/* *******************************************************
		AI                    
	******************************************************** */

	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		if (tool_call.function.name === AssistantToolName.MintNameUpdate) {
			this.form_info.get('name')?.setValue(tool_call.function.arguments.name);
			this.form_info.get('name')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintDescriptionUpdate) {
			this.form_info.get('description')?.setValue(tool_call.function.arguments.description);
			this.form_info.get('description')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintIconUrlUpdate) {
			this.form_info.get('icon_url')?.setValue(tool_call.function.arguments.icon_url);
			this.form_info.get('icon_url')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintDescriptionLongUpdate) {
			this.form_info.get('description_long')?.setValue(tool_call.function.arguments.description_long);
			this.form_info.get('description_long')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintMotdUpdate) {
			this.form_info.get('motd')?.setValue(tool_call.function.arguments.motd);
			this.form_info.get('motd')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintUrlAdd) {
			this.form_info.get('urls')?.markAsDirty();
			this.onAddUrlControl(tool_call.function.arguments.url);
			this.form_array_urls.at(-1).markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintUrlUpdate) {
			const index = this.init_info.urls.indexOf(tool_call.function.arguments.old_url);
			if (index === -1) return;
			this.form_info.get('urls')?.markAsDirty();
			this.form_array_urls.at(index).setValue(tool_call.function.arguments.url);
			this.form_array_urls.at(index).markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintUrlRemove) {
			const index = this.init_info.urls.indexOf(tool_call.function.arguments.url);
			if (index === -1) return;
			this.form_info.get('urls')?.markAsDirty();
			this.form_array_urls.removeAt(index);
		}
		if (tool_call.function.name === AssistantToolName.MintContactAdd) {
			this.form_info.get('contact')?.markAsDirty();
			this.onAddContactControl(tool_call.function.arguments.method, tool_call.function.arguments.info);
			this.form_array_contacts.at(-1).markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintContactUpdate) {
			const old_method = tool_call.function.arguments.old_method;
			const old_info = tool_call.function.arguments.old_info;
			const index = this.init_info.contact.findIndex((contact) => contact.method === old_method && contact.info === old_info);
			if (index === -1) return;
			this.form_info.get('contact')?.markAsDirty();
			this.form_array_contacts.at(index).setValue({
				method: tool_call.function.arguments.method,
				info: tool_call.function.arguments.info,
			});
			this.form_array_contacts.at(index).get('method')?.markAsDirty();
			this.form_array_contacts.at(index).get('info')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.MintContactRemove) {
			const method = tool_call.function.arguments.method;
			const info = tool_call.function.arguments.info;
			const index = this.init_info.contact.findIndex((contact) => contact.method === method && contact.info === info);
			if (index === -1) return;
			this.form_info.get('contact')?.markAsDirty();
			this.form_array_contacts.removeAt(index);
		}
		this.evaluateDirtyCount();
		this.cdr.detectChanges();
	}

	/* *******************************************************
		Clean Up                      
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
