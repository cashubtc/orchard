/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
/* Vendor Dependencies */
import {catchError, map, of, switchMap, tap} from 'rxjs';
/* Application Dependencies */
import {PublicService} from '@client/modules/public/services/image/public.service';

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
	private readonly publicService = inject(PublicService);

	public readonly name = input.required<string>();
	public readonly icon_url = input<string | null>(null);
	public readonly is_orchard = input<boolean>(false);
	public readonly height = input<string>('2.5rem');

	/** The icon as fetched by Orchard's server, so the browser never contacts the mint */
	public readonly icon_data = signal<string | null>(null);
	/** Where the icon stands, starting over for each new URL: a spinner while loading, the initials once it fails */
	public readonly icon_state = signal<'loading' | 'loaded' | 'failed'>('failed');

	/** Up to two initials from the mint name, shown when there is no icon */
	public readonly initials = computed(() =>
		this.name()
			.split(/[\s.-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0].toUpperCase())
			.join(''),
	);

	constructor() {
		toObservable(this.icon_url)
			.pipe(
				tap((url) => {
					this.icon_data.set(null);
					this.icon_state.set(url ? 'loading' : 'failed');
				}),
				switchMap((url) =>
					url
						? this.publicService.getPublicImageData(url).pipe(
								map((image) => image.data),
								catchError(() => of(null)),
							)
						: of(null),
				),
				takeUntilDestroyed(),
			)
			.subscribe((data) => {
				this.icon_data.set(data);
				this.icon_state.set(data ? 'loaded' : 'failed');
			});
	}

	/** Falls back to the initials when the icon can't be drawn */
	public onIconError(): void {
		this.icon_state.set('failed');
	}
}
