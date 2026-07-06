/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, signal, effect, HostListener, ViewChild, ElementRef, OnDestroy} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {Subscription, lastValueFrom, forkJoin, catchError, of} from 'rxjs';
import {MatTableDataSource} from '@angular/material/table';
import {MatDialog} from '@angular/material/dialog';
/* Application Dependencies */
import {EventService} from '@client/modules/event/services/event/event.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {User} from '@client/modules/crew/classes/user.class';
import {Invite} from '@client/modules/crew/classes/invite.class';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {CrewState} from '@client/modules/index/modules/index-subsection-crew/enums/crew-entity.enum';
import {StateOption, RoleOption} from '@client/modules/index/modules/index-subsection-crew/types/crew-panel.types';
import {IndexSubsectionCrewDialogUserComponent} from '@client/modules/index/modules/index-subsection-crew/components/index-subsection-crew-dialog-user/index-subsection-crew-dialog-user.component';
import {IndexSubsectionCrewDialogInviteComponent} from '@client/modules/index/modules/index-subsection-crew/components/index-subsection-crew-dialog-invite/index-subsection-crew-dialog-invite.component';
/* Shared Dependencies */
import {UserRole, AiAssistant, AssistantToolName} from '@shared/generated.types';

export enum CrewFormType {
	INVITE_CREATE = 'INVITE_CREATE',
	INVITE_EDIT = 'INVITE_EDIT',
	USER_EDIT = 'USER_EDIT',
	NONE = 'NONE',
}

@Component({
	selector: 'orc-index-subsection-crew',
	standalone: false,
	templateUrl: './index-subsection-crew.component.html',
	styleUrl: './index-subsection-crew.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSubsectionCrewComponent implements OnInit, OnDestroy {
	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	@ViewChild('invite_form', {static: false}) invite_form!: ElementRef;

	public filter_count = signal<number>(0);
	public id_user = signal<string | null>(null);
	public form_dirty = signal<boolean>(false);
	public form_invite_create_open = signal<boolean>(false);
	public table_form_id = signal<string | null>(null);
	public loading = signal<boolean>(true);
	public data = signal<MatTableDataSource<Invite | User>>(new MatTableDataSource<Invite | User>([]));
	public device_type = signal<DeviceType>('desktop');
	public readonly panel = new FormGroup({
		filter: new FormControl<string>(''),
		state: new FormControl<CrewState[]>([]),
		role: new FormControl<UserRole[]>([]),
	});
	public state_options: StateOption[] = [
		{label: 'Active', value: CrewState.ACTIVE},
		{label: 'Inactive', value: CrewState.INACTIVE},
		{label: 'Pending', value: CrewState.PENDING},
	];
	public role_options: RoleOption[] = [
		{label: 'Admin', value: UserRole.Admin},
		{label: 'Manager', value: UserRole.Manager},
		{label: 'Reader', value: UserRole.Reader},
	];
	public role_options_invite: RoleOption[] = [
		{label: 'Manager', value: UserRole.Manager},
		{label: 'Reader', value: UserRole.Reader},
	];
	public form_invite_create: FormGroup = new FormGroup({
		label: new FormControl<string>('', [Validators.maxLength(255)]),
		role: new FormControl<UserRole>(UserRole.Reader, [Validators.required]),
		expiration_enabled: new FormControl<boolean>(true, [Validators.required]),
		expiration_date: new FormControl<DateTime | null>({value: null, disabled: false}, [Validators.required]),
		expiration_time: new FormControl<number | null>({value: null, disabled: false}, [Validators.required]),
	});
	public form_invite_edit: FormGroup = new FormGroup({
		label: new FormControl<string>('', [Validators.maxLength(255)]),
		role: new FormControl<UserRole>(UserRole.Reader, [Validators.required]),
		expiration_enabled: new FormControl<boolean>(true, [Validators.required]),
		expiration_date: new FormControl<DateTime | null>({value: null, disabled: false}, [Validators.required]),
		expiration_time: new FormControl<number | null>({value: null, disabled: false}, [Validators.required]),
	});
	public form_user_edit: FormGroup = new FormGroup({
		label: new FormControl<string>('', [Validators.maxLength(255)]),
		role: new FormControl<UserRole>(UserRole.Reader, [Validators.required]),
		active: new FormControl<boolean>(true, [Validators.required]),
	});

	private active_event: EventData | null = null;
	private subscriptions: Subscription = new Subscription();
	private new_invite: Invite | null = null;
	private table_form_type: CrewFormType | null = null;

	constructor(
		private eventService: EventService,
		private configService: ConfigService,
		private settingAppService: SettingAppService,
		private crewService: CrewService,
		private aiService: AiService,
		private dialog: MatDialog,
		private breakpointObserver: BreakpointObserver,
	) {
		effect(() => {
			const dirty = this.form_dirty();
			this.createPendingEvent(dirty);
		});
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	ngOnInit(): void {
		this.loadCrewData();
		this.subscriptions.add(this.getUserSubscription());
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getPanelFormSubscription());
		this.subscriptions.add(this.getInviteFormSubscription());
		this.subscriptions.add(this.getUserFormSubscription());
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

	private getUserSubscription(): Subscription {
		return this.crewService.user$.subscribe({
			next: (user: User | null) => {
				if (user === undefined || user === null) return;
				this.id_user.set(user.id);
			},
			error: (error) => {
				console.error(error);
				this.id_user.set(null);
			},
		});
	}

	private getEventSubscription(): Subscription {
		return this.eventService.getActiveEvent().subscribe((event_data: EventData | null) => {
			this.active_event = event_data;
			if (event_data === null) {
				setTimeout(() => {
					if (this.form_invite_create_open()) {
						this.form_dirty.set(true);
					} else {
						this.evaluateDirtyCount();
					}
				}, 100);
			}
			if (event_data) {
				if (event_data.type === 'SUCCESS') this.eventSuccess();
				if (event_data.confirmed !== null) event_data.confirmed ? this.eventConfirmed() : this.onCloseInviteForm();
			}
		});
	}

	private getPanelFormSubscription(): Subscription {
		return this.panel.valueChanges.subscribe(() => {
			this.applyFilters();
		});
	}

	private getInviteFormSubscription(): Subscription {
		return this.form_invite_edit.valueChanges.subscribe(() => {
			this.evaluateDirtyCount();
		});
	}

	private getUserFormSubscription(): Subscription {
		return this.form_user_edit.valueChanges.subscribe(() => {
			this.evaluateDirtyCount();
		});
	}

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			const form_type = this.getActiveFormType();
			const form_group = this.getActiveFormGroup();
			if (!form_group) return this.hireAnalyticsAssistant(assistant, content);
			switch (form_type) {
				case CrewFormType.INVITE_CREATE:
					return this.hireInviteAssistant(AiAssistant.IndexCrewInvite, form_group, content);
				case CrewFormType.INVITE_EDIT:
					return this.hireInviteAssistant(AiAssistant.IndexCrewInvite, form_group, content);
				case CrewFormType.USER_EDIT:
					return this.hireUserAssistant(AiAssistant.IndexCrewUser, content);
				case CrewFormType.NONE:
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

	/* *******************************************************
	   Data                      
	******************************************************** */

	/**
	 * Loads crew data (users and invites) and combines into a single table
	 * Allows partial failure - if one endpoint fails, the other will still display
	 * Invites can fail due to authorization errors, but users will still be displayed
	 * @returns {Promise<void>}
	 */
	private async loadCrewData(): Promise<void> {
		const users_obs = this.crewService.loadUsers().pipe(
			catchError((error) => {
				console.error('Failed to load users:', error);
				return of([]);
			}),
		);
		const invites_obs = this.crewService.loadInvites().pipe(
			catchError((error) => {
				console.error('Failed to load invites:', error);
				return of([]);
			}),
		);
		const [users, invites] = await lastValueFrom(forkJoin([users_obs, invites_obs]));
		const combined_data = [...users, ...invites];
		if (this.data().data.length === 0) this.setupDataSource();
		this.data().data = combined_data;
		if (this.loading()) this.loading.set(false);
	}

	/**
	 * Sets up filter and sort configuration for the data source (called once on init)
	 */
	private setupDataSource(): void {
		const data_source = this.data();
		data_source.filterPredicate = (entity: Invite | User, filter_string: string) => {
			const {text, state, role} = JSON.parse(filter_string);
			const now = DateTime.now().toUnixInteger();
			const entity_state =
				'name' in entity
					? entity.active
						? CrewState.ACTIVE
						: CrewState.INACTIVE
					: entity.expires_at && entity.expires_at < now
						? CrewState.INACTIVE
						: CrewState.PENDING;
			const searchable = `${'name' in entity ? entity.name : ''} ${entity.label || ''} ${entity.role}`.toLowerCase();
			return searchable.includes(text) && state.includes(entity_state) && role.includes(entity.role);
		};

		data_source.sortingDataAccessor = (entity: Invite | User, column_id: string) => {
			const now = DateTime.now().toUnixInteger();
			switch (column_id) {
				case 'created':
					return entity.created_at;
				case 'state':
					return 'name' in entity ? (entity.active ? 2 : 0) : entity.expires_at && entity.expires_at < now ? 0 : 1;
				case 'user':
					return 'name' in entity ? entity.name : '';
				case 'label':
					return entity.label || '';
				default:
					return (entity as any)[column_id];
			}
		};
	}

	private createInvite(): void {
		if (this.form_invite_create.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid invite',
				}),
			);
		}
		const {label, role, expiration_enabled, expiration_date, expiration_time} = this.form_invite_create.value;
		const expiration_timestamp = this.getExpirationTimestamp(expiration_enabled, expiration_date, expiration_time);
		const now = Math.floor(DateTime.now().toSeconds());
		if (expiration_timestamp && expiration_timestamp < now) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Expiration date is in the past',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.form_invite_create_open.set(false);
		this.crewService.createInvite(role, label, expiration_timestamp).subscribe({
			next: (invite) => {
				this.new_invite = invite;
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Invite created!',
					}),
				);
			},
			error: (errors: OrchardErrors) => {
				this.new_invite = null;
				this.eventService.registerEvent(
					new EventData({
						type: 'ERROR',
						message: errors.errors[0].getFullError(),
					}),
				);
			},
		});
	}

	private updateInvite(): void {
		if (this.form_invite_edit.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid invite',
				}),
			);
		}
		const {label, role, expiration_enabled, expiration_date, expiration_time} = this.form_invite_edit.value;
		const expiration_timestamp = this.getExpirationTimestamp(expiration_enabled, expiration_date, expiration_time);
		const now = Math.floor(DateTime.now().toSeconds());
		if (expiration_timestamp && expiration_timestamp < now) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Expiration date is in the past',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (!this.table_form_id()) return;
		this.crewService.updateInvite(this.table_form_id()!, label, role, expiration_timestamp).subscribe({
			next: (_updated_invite) => {
				this.form_invite_edit.markAsPristine();
				this.form_dirty.set(false);
				this.table_form_id.set(null);
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Invite updated!',
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

	private updateUser(): void {
		if (this.form_user_edit.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid user',
				}),
			);
		}
		const {label, role, active} = this.form_user_edit.value;
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		if (!this.table_form_id()) return;
		this.crewService.updateUser(this.table_form_id()!, label, role, active).subscribe({
			next: (_updated_user) => {
				this.form_user_edit.markAsPristine();
				this.form_dirty.set(false);
				this.table_form_id.set(null);
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'User updated!',
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

	private deleteInvite(invite: Invite): void {
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.crewService.deleteInvite(invite.id).subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Invite deleted!',
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

	private deleteUser(user: User): void {
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.crewService.deleteUser(user.id).subscribe({
			next: () => {
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'User deleted!',
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

	private getExpirationTimestamp(
		expiration_enabled: boolean,
		expiration_date: DateTime | null,
		expiration_time: number | null,
	): number | null {
		if (!expiration_enabled) return null;
		if (!expiration_date || !expiration_time) return null;
		return expiration_date
			.set({
				hour: expiration_time,
				minute: 0,
				second: 0,
				millisecond: 0,
			})
			.toSeconds();
	}

	/* *******************************************************
		Actions Up                     
	******************************************************** */

	public onInvite(): void {
		!this.form_invite_create_open() ? this.openInviteForm() : this.onCloseInviteForm();
	}

	public onCloseInviteForm(): void {
		this.form_invite_create_open.set(false);
		this.eventService.registerEvent(null);
	}

	public onCancel(control_name: 'label' | 'role' | 'expiration'): void {
		if (control_name === 'role') {
			this.form_invite_create.get('role')?.setValue(UserRole.Reader);
			this.form_invite_create.get(control_name)?.markAsPristine();
			this.form_invite_create.get(control_name)?.markAsUntouched();
			this.form_invite_create.get(control_name)?.updateValueAndValidity();
		}
		if (control_name === 'label') {
			this.form_invite_create.get('label')?.setValue('');
			this.form_invite_create.get(control_name)?.markAsPristine();
			this.form_invite_create.get(control_name)?.markAsUntouched();
			this.form_invite_create.get(control_name)?.updateValueAndValidity();
		}
		if (control_name === 'expiration') {
			const now = DateTime.now();
			const eight_hours_from_now = now.plus({hours: 8});
			const expiration_time = eight_hours_from_now.hour;
			this.form_invite_create.get('expiration_time')?.setValue(expiration_time);
			this.form_invite_create.get('expiration_date')?.setValue(eight_hours_from_now);
			this.form_invite_create.get('expiration_time')?.markAsPristine();
			this.form_invite_create.get('expiration_time')?.markAsUntouched();
			this.form_invite_create.get('expiration_time')?.updateValueAndValidity();
			this.form_invite_create.get('expiration_date')?.markAsPristine();
			this.form_invite_create.get('expiration_date')?.markAsUntouched();
			this.form_invite_create.get('expiration_date')?.updateValueAndValidity();
		}
	}

	public onEditInvite(invite: Invite): void {
		this.onCloseInviteForm();
		this.table_form_type = CrewFormType.INVITE_EDIT;
		this.table_form_id.set(invite.id);
		this.form_invite_edit.get('role')?.setValue(invite.role);
		this.form_invite_edit.get('label')?.setValue(invite.label);
		if (invite.expires_at !== null) {
			const expiration_datetime = DateTime.fromSeconds(invite.expires_at);
			const expiration_hour = expiration_datetime.hour;
			this.form_invite_edit.get('expiration_enabled')?.setValue(true);
			this.form_invite_edit.get('expiration_date')?.setValue(expiration_datetime);
			this.form_invite_edit.get('expiration_time')?.setValue(expiration_hour);
		} else {
			const now = DateTime.now();
			const eight_hours_from_now = now.plus({hours: 8});
			const expiration_time = eight_hours_from_now.hour;
			this.form_invite_edit.get('expiration_enabled')?.setValue(false);
			this.form_invite_edit.get('expiration_date')?.setValue(eight_hours_from_now);
			this.form_invite_edit.get('expiration_time')?.setValue(expiration_time);
			this.form_invite_edit.get('expiration_date')?.disable();
			this.form_invite_edit.get('expiration_time')?.disable();
		}
	}

	public onEditUser(user: User): void {
		this.onCloseInviteForm();
		this.table_form_type = CrewFormType.USER_EDIT;
		this.table_form_id.set(user.id);
		this.form_user_edit.get('label')?.setValue(user.label);
		this.form_user_edit.get('role')?.setValue(user.role);
		this.form_user_edit.get('active')?.setValue(user.active);
	}

	public onDeleteInvite(invite: Invite): void {
		const dialog_ref = this.dialog.open(IndexSubsectionCrewDialogInviteComponent, {
			data: {
				invite: invite,
			},
		});
		dialog_ref.afterClosed().subscribe((confirmed) => {
			if (confirmed === true) this.deleteInvite(invite);
		});
	}

	public onDeleteUser(user: User): void {
		const dialog_ref = this.dialog.open(IndexSubsectionCrewDialogUserComponent, {
			data: {
				user: user,
			},
		});
		dialog_ref.afterClosed().subscribe((confirmed) => {
			if (confirmed === true) this.deleteUser(user);
		});
	}

	public onCloseTableForm(): void {
		this.table_form_id.set(null);
	}

	/* *******************************************************
		Events                     
	******************************************************** */

	private eventConfirmed(): void {
		if (this.form_invite_create_open()) this.createInvite();
		else {
			if (this.form_invite_edit.dirty) this.updateInvite();
			if (this.form_user_edit.dirty) this.updateUser();
		}
	}

	private async eventSuccess(): Promise<void> {
		if (this.new_invite) {
			const current_data = this.data().data;
			this.data().data = [this.new_invite, ...current_data];
			this.new_invite = null;
		} else {
			this.crewService.clearInvitesCache();
			this.crewService.clearUserCache();
			this.loadCrewData();
		}
	}

	private createPendingEvent(dirty: boolean): void {
		if (!dirty && this.active_event?.type !== 'PENDING') return;
		if (!dirty) return this.eventService.registerEvent(null);
		const message = 'update';
		this.eventService.registerEvent(
			new EventData({
				type: 'PENDING',
				message: message,
			}),
		);
	}

	/* *******************************************************
		Form                
	******************************************************** */

	private openInviteForm(): void {
		const now = DateTime.now();
		const eight_hours_from_now = now.plus({hours: 8});
		const expiration_time = eight_hours_from_now.hour;
		this.form_invite_create.reset();
		this.form_invite_create.get('role')?.setValue(UserRole.Reader);
		this.form_invite_create.get('expiration_enabled')?.setValue(true);
		this.form_invite_create.get('expiration_date')?.setValue(eight_hours_from_now);
		this.form_invite_create.get('expiration_time')?.setValue(expiration_time);
		this.form_invite_create_open.set(!this.form_invite_create_open());
		this.eventService.registerEvent(
			new EventData({
				type: 'PENDING',
				message: 'Save',
			}),
		);
		this.invite_form.nativeElement.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
			inline: 'nearest',
		});
	}

	private evaluateDirtyCount(): void {
		this.form_dirty.set(false);
		const invite_control_count = Object.keys(this.form_invite_edit.controls)
			.filter((key) => this.form_invite_edit.get(key) instanceof FormControl)
			.filter((key) => this.form_invite_edit.get(key)?.dirty).length;
		const user_control_count = Object.keys(this.form_user_edit.controls)
			.filter((key) => this.form_user_edit.get(key) instanceof FormControl)
			.filter((key) => this.form_user_edit.get(key)?.dirty).length;
		const control_count = invite_control_count + user_control_count;
		this.form_dirty.set(control_count > 0);
	}

	/**
	 * Determines which form is currently open based on component state
	 * @returns {CrewFormType} The type of form currently open
	 */
	private getActiveFormType(): CrewFormType {
		if (this.form_invite_create_open()) return CrewFormType.INVITE_CREATE;
		if (this.table_form_id()) {
			if (this.table_form_type === CrewFormType.INVITE_EDIT) return CrewFormType.INVITE_EDIT;
			if (this.table_form_type === CrewFormType.USER_EDIT) return CrewFormType.USER_EDIT;
		}
		return CrewFormType.NONE;
	}

	/**
	 * Returns the active form group based on which form is currently open
	 * @returns {FormGroup | null} The active form group or null if no form is open
	 */
	private getActiveFormGroup(): FormGroup | null {
		const form_type = this.getActiveFormType();
		switch (form_type) {
			case CrewFormType.INVITE_CREATE:
				return this.form_invite_create;
			case CrewFormType.INVITE_EDIT:
				return this.form_invite_edit;
			case CrewFormType.USER_EDIT:
				return this.form_user_edit;
			default:
				return null;
		}
	}

	/* *******************************************************
		Table                
	******************************************************** */

	/**
	 * Applies all active filters (text, state, role) to the table data
	 */
	private applyFilters(): void {
		const text = (this.panel.get('filter')?.value || '').trim().toLowerCase();
		let state = this.panel.get('state')?.value || [];
		let role = this.panel.get('role')?.value || [];
		const state_count = state.length > 0 ? 1 : 0;
		const role_count = role.length > 0 ? 1 : 0;
		this.filter_count.set(state_count + role_count);
		if (state.length === 0) state = [CrewState.ACTIVE, CrewState.INACTIVE, CrewState.PENDING];
		if (role.length === 0) role = [UserRole.Admin, UserRole.Manager, UserRole.Reader];
		this.data().filter = JSON.stringify({text, state, role});
	}

	/* *******************************************************
		AI                     
	******************************************************** */

	private hireAnalyticsAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Current Search:** ${this.panel.get('filter')?.value || ''}\n`;
		context += `* **Current State:** ${this.panel.get('state')?.value || []}\n`;
		context += `* **Current Role:** ${this.panel.get('role')?.value || []}\n`;
		this.aiService.openAiSocket(assistant, content, context);
	}

	private hireInviteAssistant(assistant: AiAssistant, form: FormGroup, content: string | null): void {
		let context = `* **Current Date:** ${DateTime.now().toISO()}\n`;
		context += `* **Current Label:** ${form.get('label')?.value || ''}\n`;
		context += `* **Current Role:** ${form.get('role')?.value || UserRole.Reader}\n`;
		context += `* **Current Expiration Enabled:** ${form.get('expiration_enabled')?.value || true}\n`;
		context += `* **Current Expiration Date:** ${form.get('expiration_date')?.value || null}\n`;
		context += `* **Current Expiration Time:** ${form.get('expiration_time')?.value || null}\n`;
		this.aiService.openAiSocket(assistant, content, context);
	}

	private hireUserAssistant(assistant: AiAssistant, content: string | null): void {
		let context = `* **Current Label:** ${this.form_user_edit.get('label')?.value || ''}\n`;
		context += `* **Current Role:** ${this.form_user_edit.get('role')?.value || UserRole.Reader}\n`;
		context += `* **Current Active:** ${this.form_user_edit.get('active')?.value || true}\n`;
		this.aiService.openAiSocket(assistant, content, context);
	}

	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		if (tool_call.function.name === AssistantToolName.UpdateSearch) {
			this.panel.get('filter')?.setValue(tool_call.function.arguments.search);
			this.applyFilters();
		}
		if (tool_call.function.name === AssistantToolName.CrewStatesUpdate) {
			this.panel.get('state')?.setValue(tool_call.function.arguments.states as CrewState[]);
			this.applyFilters();
		}
		if (tool_call.function.name === AssistantToolName.CrewRolesUpdate) {
			this.panel.get('role')?.setValue(tool_call.function.arguments.roles as UserRole[]);
			this.applyFilters();
		}

		const form_group = this.getActiveFormGroup();
		if (!form_group) return;

		if (tool_call.function.name === AssistantToolName.CrewInviteRoleUpdate) {
			form_group.get('role')?.setValue(tool_call.function.arguments.role as UserRole);
			form_group.get('role')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.CrewInviteExpirationEnabledUpdate) {
			form_group.get('expiration_enabled')?.setValue(tool_call.function.arguments.expiration_enabled as boolean);
			form_group.get('expiration_enabled')?.markAsDirty();
			if (tool_call.function.arguments.expiration_enabled as boolean) {
				form_group.get('expiration_date')?.enable();
				form_group.get('expiration_time')?.enable();
			} else {
				form_group.get('expiration_date')?.disable();
				form_group.get('expiration_time')?.disable();
			}
		}
		if (tool_call.function.name === AssistantToolName.CrewInviteExpirationUpdate) {
			form_group.get('expiration_date')?.setValue(DateTime.fromISO(tool_call.function.arguments.expiration_datetime));
			form_group.get('expiration_time')?.setValue(form_group.get('expiration_date')?.value?.hour || null);
			form_group.get('expiration_date')?.markAsDirty();
			form_group.get('expiration_time')?.markAsDirty();
		}
		if (tool_call.function.name === AssistantToolName.CrewLabelUpdate) {
			form_group.get('label')?.setValue(tool_call.function.arguments.label as string);
			form_group.get('label')?.markAsDirty();
		}

		if (tool_call.function.name === AssistantToolName.CrewUserActiveUpdate) {
			form_group.get('active')?.setValue(tool_call.function.arguments.active as boolean);
			form_group.get('active')?.markAsDirty();
		}

		this.evaluateDirtyCount();
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
