/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild} from '@angular/core';
import {FormGroup} from '@angular/forms';
/* Vendor Dependencies */
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {MatDialog} from '@angular/material/dialog';
import {MatSlideToggle} from '@angular/material/slide-toggle';
/* Native Dependencies */
import {MintSubsectionConfigFormEnabledDialogComponent} from '../mint-subsection-config-form-enabled-dialog/mint-subsection-config-form-enabled-dialog.component';

@Component({
	selector: 'orc-mint-subsection-config-form-enabled',
	standalone: false,
	templateUrl: './mint-subsection-config-form-enabled.component.html',
	styleUrl: './mint-subsection-config-form-enabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormEnabledComponent {
	public readonly member = input<boolean>(false);
	public nut = input.required<'nut4' | 'nut5'>(); // which nut configuration this controls
	public form_group = input.required<FormGroup>(); // form group containing the enabled control
	public enabled = input<boolean>(true); // current enabled state
	public device_desktop = input<boolean>(false); // whether the desktop view is active

	public update = output<{form_group: FormGroup; nut: 'nut4' | 'nut5'}>(); // emitted when the enabled state changes

	public toggle = viewChild<MatSlideToggle>('toggle'); // reference to the slide toggle element

	public help_status = signal<boolean>(false); // tracks if the help is visible

	public help_text = computed(() => {
		if (this.nut() === 'nut4')
			return 'Control the minting of new ecash.<br> Disable to prevent deposits into the mint and new ecash from being minted.';
		if (this.nut() === 'nut5')
			return 'Control the melting of ecash.<br> Disable to prevent withdrawals from the mint and ecash from being melted.';
		return '';
	});

	private dialog = inject(MatDialog);

	constructor() {
		effect(() => {
			const enabled = this.enabled();
			const toggle = this.toggle();
			if (!toggle) return;
			if (enabled === toggle.checked) return;
			toggle.checked = enabled;
			enabled ? this.form_group().get('enabled')?.setValue(true) : this.launchDialog();
		});
	}

	public onChange(event: MatSlideToggleChange): void {
		event.checked ? this.onConfirm(true) : this.launchDialog();
	}

	private launchDialog(): void {
		const dialog_ref = this.dialog.open(MintSubsectionConfigFormEnabledDialogComponent, {
			data: {nut: this.nut(), member: this.member()},
		});
		dialog_ref.afterClosed().subscribe((decision) => {
			decision === true ? this.onConfirm(false) : this.onCancel();
		});
	}

	private onConfirm(value: boolean): void {
		this.form_group().get('enabled')?.setValue(value);
		this.update.emit({form_group: this.form_group(), nut: this.nut()});
	}

	private onCancel(): void {
		const toggle = this.toggle();
		if (toggle) toggle.checked = true;
		this.form_group().get('enabled')?.setValue(true);
	}
}
