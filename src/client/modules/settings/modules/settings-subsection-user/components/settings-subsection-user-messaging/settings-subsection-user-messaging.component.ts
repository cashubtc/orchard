/* Core Dependencies */
import {ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild} from '@angular/core';
import {FormGroup} from '@angular/forms';
/* Application Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';

@Component({
	selector: 'orc-settings-subsection-user-messaging',
	standalone: false,
	templateUrl: './settings-subsection-user-messaging.component.html',
	styleUrl: './settings-subsection-user-messaging.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSubsectionUserMessagingComponent {
	public element_control = viewChild.required<ElementRef<HTMLInputElement>>('element_control');

	public form_group = input.required<FormGroup>();
	public control_name = input.required<string>();
	public invalid = input<boolean>(false);
	public dirty = input<boolean>(false);
	public ai_enabled = input<boolean>(false);
	public messages_enabled = input<boolean>(false);
	public device_type = input<DeviceType>('desktop');

	public cancel = output<string>();
	public submit = output<void>();

	public focused = signal<boolean>(false);
	public help_status = signal<boolean>(false);

	public hot = computed(() => {
		return this.focused() || this.dirty();
	});
	public control = computed(() => {
		return this.form_group().get(this.control_name());
	});
	public disabled_message = computed(() => {
		if (!this.ai_enabled()) {
			return 'AI currently disabled';
		} else if (!this.messages_enabled()) {
			return 'Messaging currently disabled';
		}
		return null;
	});

	/** Cancel handler — emits control name to parent */
	public onCancel(event: Event): void {
		event.preventDefault();
		this.cancel.emit(this.control_name());
	}

	/** Submit handler — blurs input and emits to parent */
	public onSubmit(event: Event): void {
		event.preventDefault();
		this.element_control().nativeElement.blur();
		this.submit.emit();
	}
}
