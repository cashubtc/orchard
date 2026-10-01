/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';

@Component({
	selector: 'orc-ecash-general-mint-icon',
	standalone: false,
	templateUrl: './ecash-general-mint-icon.component.html',
	styleUrl: './ecash-general-mint-icon.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[style.--size]': 'height()',
		'[class.orchard]': 'is_orchard()',
	},
})
export class EcashGeneralMintIconComponent {
	public readonly name = input.required<string>();
	public readonly icon_url = input<string | null>(null);
	public readonly is_orchard = input<boolean>(false);
	public readonly height = input<string>('2.5rem');

	/** Set when the icon fails to load, so the initials show instead */
	public readonly icon_failed = signal<boolean>(false);

	/** Up to two initials from the mint name, shown when there is no icon */
	public readonly initials = computed(() =>
		this.name()
			.split(/[\s.-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0].toUpperCase())
			.join(''),
	);

	/** Falls back to the initials when the icon fails to load */
	public onIconError(): void {
		this.icon_failed.set(true);
	}
}
