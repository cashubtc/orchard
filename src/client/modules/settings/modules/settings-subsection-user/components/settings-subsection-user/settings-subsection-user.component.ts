/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, effect, HostListener} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {User} from '@client/modules/crew/classes/user.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {ParsedAppSettings} from '@client/modules/settings/types/setting-app.types';

@Component({
	selector: 'orc-settings-subsection-user',
	standalone: false,
	templateUrl: './settings-subsection-user.component.html',
	styleUrl: './settings-subsection-user.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSubsectionUserComponent implements ComponentCanDeactivate, OnInit, OnDestroy {
	@HostListener('window:beforeunload')
	canDeactivate(): boolean {
		return this.active_event?.type !== 'PENDING';
	}

	public form_user: FormGroup = new FormGroup({
		name: new FormControl(null, [Validators.required, Validators.maxLength(50)]),
		telegram_chat_id: new FormControl(null),
	});

	public user = signal<User | null>(null);
	public device_type = signal<DeviceType>('desktop');
	public settings = signal<ParsedAppSettings | null>(null);
	private dirty_count = signal<number>(0);

	private active_event: EventData | null = null;
	private subscriptions: Subscription = new Subscription();

	constructor(
		private crewService: CrewService,
		private eventService: EventService,
		private breakpointObserver: BreakpointObserver,
		private settingAppService: SettingAppService,
	) {
		effect(() => {
			this.createPendingEvent(this.dirty_count());
		});
	}

	ngOnInit(): void {
		this.subscriptions.add(this.getUserSubscription());
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getFormSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.settings.set(this.settingAppService.getParsedSettings());
		this.updateMessagingDisabled();
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	private getUserSubscription(): Subscription {
		return this.crewService.user$.subscribe((user) => {
			if (user === undefined || user === null) return;
			this.user.set(new User(user));
			this.setFormUser();
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
		return this.form_user.valueChanges.subscribe(() => {
			this.evaluateDirtyCount();
		});
	}

	private getBreakpointSubscription(): Subscription {
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

	private setFormUser(): void {
		this.form_user.setValue(
			{
				name: this.user()?.name ?? null,
				telegram_chat_id: this.user()?.telegram_chat_id ?? null,
			},
			{emitEvent: false},
		);
	}

	private updateMessagingDisabled(): void {
		const parsed_settings = this.settings();
		const telegram_control = this.form_user.get('telegram_chat_id');
		if (!parsed_settings?.ai_enabled?.value || !parsed_settings?.messages_enabled?.value) {
			telegram_control?.disable({emitEvent: false});
		} else {
			telegram_control?.enable({emitEvent: false});
		}
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	public onCancelUserName(control_name: string): void {
		this.resetControl(control_name, this.user()?.name ?? null);
	}

	public onCancelTelegram(control_name: string): void {
		this.resetControl(control_name, this.user()?.telegram_chat_id ?? null);
	}

	public onSubmitUserName(): void {
		const name_control = this.form_user.get('name');
		if (name_control?.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid info',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.crewService.updateUserName(this.form_user.value.name).subscribe({
			next: () => {
				this.crewService.clearUserCache();
				this.crewService.loadUser().subscribe();
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Username updated!',
					}),
				);
				name_control?.setValue(this.user()?.name ?? null, {emitEvent: false});
				name_control?.markAsPristine();
				this.evaluateDirtyCount();
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

	public onSubmitTelegram(): void {
		const telegram_control = this.form_user.get('telegram_chat_id');
		if (telegram_control?.invalid) {
			return this.eventService.registerEvent(
				new EventData({
					type: 'WARNING',
					message: 'Invalid info',
				}),
			);
		}
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		const value = this.form_user.value.telegram_chat_id || null;
		this.crewService.updateUserTelegram(value).subscribe({
			next: () => {
				this.crewService.clearUserCache();
				this.crewService.loadUser().subscribe();
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'Telegram Chat ID updated!',
					}),
				);
				telegram_control?.setValue(this.user()?.telegram_chat_id ?? null, {emitEvent: false});
				telegram_control?.markAsPristine();
				this.evaluateDirtyCount();
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

	private resetControl(control_name: string, value: unknown): void {
		const control = this.form_user.get(control_name);
		control?.setValue(value, {emitEvent: false});
		control?.markAsPristine();
		control?.markAsUntouched();
		control?.setErrors(null);
		this.evaluateDirtyCount();
	}

	/* *******************************************************
		Actions Up — Password
	******************************************************** */

	public onSaveUserPassword(form_password: FormGroup): void {
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.crewService.updateUserPassword(form_password.value.password_current, form_password.value.password_new).subscribe({
			next: () => {
				this.crewService.clearUserCache();
				this.crewService.loadUser().subscribe();
				this.eventService.registerEvent(
					new EventData({
						type: 'SUCCESS',
						message: 'User password updated!',
					}),
				);
				this.evaluateDirtyCount();
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

	/* *******************************************************
		Events
	******************************************************** */

	private evaluateDirtyCount(): void {
		const control_count = Object.values(this.form_user.controls).filter((control) => control.dirty).length;
		this.dirty_count.set(control_count);
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

	private onConfirmedEvent(): void {
		if (this.form_user.get('name')?.dirty) this.onSubmitUserName();
		if (this.form_user.get('telegram_chat_id')?.dirty) this.onSubmitTelegram();
	}

	private onUnconfirmedEvent(): void {
		this.onCancelUserName('name');
		this.onCancelTelegram('telegram_chat_id');
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
