/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input, output, signal} from '@angular/core';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {getUnitMeta, getUnitSign} from '@client/modules/local/helpers/unit.helpers';
import {getNumberSeparator} from '@client/modules/local/helpers/local.helpers';
/* Native Dependencies */
import {buildAmountChars} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-amount-hero',
	standalone: false,
	templateUrl: './ecash-general-amount-hero.component.html',
	styleUrl: './ecash-general-amount-hero.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralAmountHeroComponent {
	private readonly settingDeviceService = inject(SettingDeviceService);

	public readonly text = input<string>('');
	public readonly unit = input.required<string>();
	public readonly editable = input<boolean>(false);

	public readonly key = output<string>();
	public readonly replace = output<string>();

	public readonly focused = signal<boolean>(false);

	public readonly chars = computed(() => buildAmountChars(this.text(), getUnitMeta(this.unit()).decimals, this.locale));
	public readonly sign = computed(() => getUnitSign(this.unit(), this.settingDeviceService.getCurrency()));

	/** How many ems the amount spans with its sign, which is drawn smaller, so its size can fit the width */
	public readonly width_ems = computed(() => this.chars().length * 0.6 + this.sign().text.length * 0.36 + 0.25);

	private readonly locale = this.settingDeviceService.getLocale();
	private readonly decimal_separator = getNumberSeparator(this.locale, 'decimal');

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Turns typing and deleting into keypad keys; a paste or a fully selected amount is replaced in one go */
	public onBeforeInput(event: InputEvent): void {
		event.preventDefault();
		const input = event.target as HTMLInputElement;
		const deleting = event.inputType.startsWith('delete');
		const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
		const keys = [...data].map((char) => this.toKey(char)).filter((key) => key !== null);
		const replacing =
			event.inputType === 'insertFromPaste' || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
		if (replacing) this.replace.emit(deleting ? '' : keys.join(''));
		else if (deleting) this.key.emit('backspace');
		else keys.forEach((key) => this.key.emit(key));
	}

	/** A digit as itself and the locale's decimal separator as '.'; anything else is no key */
	private toKey(char: string): string | null {
		if (/\d/.test(char)) return char;
		return char === this.decimal_separator ? '.' : null;
	}
}
