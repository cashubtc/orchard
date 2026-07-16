/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject} from '@angular/core';
import {Router, Event, ActivatedRoute, NavigationStart, NavigationEnd, NavigationCancel, NavigationError} from '@angular/router';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
/* Application Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {PublicService} from '@client/modules/public/services/image/public.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {PublicImage} from '@client/modules/public/classes/public-image.class';

@Component({
	selector: 'orc-mint-section',
	standalone: false,
	templateUrl: './mint-section.component.html',
	styleUrl: './mint-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSectionComponent implements OnInit, OnDestroy {
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly mintService = inject(MintService);
	private readonly publicService = inject(PublicService);
	private readonly settingAppService = inject(SettingAppService);

	public readonly show_server = !!this.settingAppService.getSetting('mint_metrics_api').value;

	public readonly mint_info = signal<MintInfo | null>(null);
	public readonly icon_data = signal<string | null>(null);
	public readonly active_sub_section = signal<string>('');
	public readonly loading = signal<boolean>(true);
	public readonly error = signal<boolean>(false);
	public readonly overlayed = signal(false);

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.mintService.loadMintInfo().subscribe({
			error: (error) => {
				console.error(error);
				this.error.set(true);
				this.loading.set(false);
			},
		});
		this.subscriptions.add(this.getMintInfoSubscription());
		this.subscriptions.add(this.getRouterSubscription());
		this.subscriptions.add(this.getOverlaySubscription());
	}

	private getMintInfoSubscription(): Subscription {
		return this.mintService.mint_info$.subscribe((info: MintInfo | null) => {
			if (!info) return;
			this.mint_info.set(info);
			this.loadImageData(info?.icon_url);
		});
	}

	private getRouterSubscription(): Subscription {
		return this.router.events.pipe(filter((event: Event) => 'routerEvent' in event || 'type' in event)).subscribe((event) => {
			this.active_sub_section.set(this.getSubSection(event));
		});
	}

	/**
	 * Subscribes to router events to control overlay visibility
	 * Shows overlay on navigation start, hides on end/cancel/error
	 * @returns {Subscription} router events subscription
	 */
	private getOverlaySubscription(): Subscription {
		return this.router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				const segments = event.url.split('/').filter(Boolean);
				if (segments[0] === 'mint') this.overlayed.set(true);
			}
			if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
				this.overlayed.set(false);
			}
		});
	}

	private getSubSection(event: Event): string {
		if (event instanceof NavigationStart) {
			const segments = event.url.split('/').filter(Boolean);
			if (segments[0] !== 'mint') return this.active_sub_section();
			return segments[1] || 'dashboard';
		}

		const router_event = 'routerEvent' in event ? event.routerEvent : event;
		if (router_event.type !== 1) return this.active_sub_section();
		let route = this.route.root;
		while (route.firstChild) {
			route = route.firstChild;
		}
		if (route.snapshot.data['sub_section'] === 'error') return route.snapshot.data['origin'] || '';
		return route.snapshot.data['sub_section'] || '';
	}

	private loadImageData(image_url: string | null | undefined): void {
		if (!image_url) {
			this.icon_data.set(null);
			this.loading.set(false);
			return;
		}
		this.publicService.getPublicImageData(image_url).subscribe(
			(image: PublicImage) => {
				this.loading.set(false);
				this.icon_data.set(image.data);
			},
			(error) => {
				console.error(error);
				this.error.set(true);
				this.loading.set(false);
			},
		);
	}

	public onClickMintName(): void {
		this.router.navigate(['mint', 'info']);
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
