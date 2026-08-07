/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject} from '@angular/core';
import {Router, Event, ActivatedRoute, NavigationStart} from '@angular/router';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';
/* Native Dependencies */
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {LightningInfo} from '@client/modules/lightning/classes/lightning-info.class';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';

@Component({
	selector: 'orc-lightning-section',
	standalone: false,
	templateUrl: './lightning-section.component.html',
	styleUrl: './lightning-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningSectionComponent implements OnInit, OnDestroy {
	private readonly navService = inject(NavService);
	private readonly lightningService = inject(LightningService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly menu_items: NavSecondaryItem[] = this.navService.getMenuItems('lightning');

	public lightning_info = signal<LightningInfo | null>(null);
	public active_sub_section = signal<string>('');
	public loading = signal<boolean>(true);
	public error = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.lightningService.loadLightningInfo().subscribe({
			error: (error) => {
				console.error(error);
				this.error.set(true);
				this.loading.set(false);
			},
		});
		this.subscriptions.add(this.getLightningInfoSubscription());
		this.subscriptions.add(this.getRouterSubscription());
	}

	private getLightningInfoSubscription(): Subscription {
		return this.lightningService.lightning_info$.subscribe((info: LightningInfo | null) => {
			if (!info) return;
			this.lightning_info.set(info);
			this.loading.set(false);
		});
	}

	private getRouterSubscription(): Subscription {
		return this.router.events.pipe(filter((event: Event) => 'routerEvent' in event || 'type' in event)).subscribe((event) => {
			this.active_sub_section.set(this.getSubSection(event));
		});
	}

	private getSubSection(event: Event): string {
		if (event instanceof NavigationStart) {
			const segments = event.url.split('/').filter(Boolean);
			if (segments[0] !== 'lightning') return this.active_sub_section();
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

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
