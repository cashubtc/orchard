/* Core Dependencies */
import {ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy, inject} from '@angular/core';
import {Router, Event, ActivatedRoute, NavigationStart, NavigationEnd, NavigationCancel, NavigationError} from '@angular/router';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';

@Component({
	selector: 'orc-index-section',
	standalone: false,
	templateUrl: './index-section.component.html',
	styleUrl: './index-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSectionComponent implements OnInit, OnDestroy {
	private readonly navService = inject(NavService);
	private readonly configService = inject(ConfigService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly menu_items: NavSecondaryItem[] = this.navService.getMenuItems('index');

	public version = signal<string>('');
	public active_sub_section = signal<string>('');
	public overlayed = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();

	constructor() {
		this.version.set(this.configService.config.mode.version);
	}

	ngOnInit(): void {
		this.subscriptions.add(this.getRouterSubscription());
		this.subscriptions.add(this.getOverlaySubscription());
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
				if (segments[0] === undefined || segments[0] === 'crew' || segments[0] === 'system') this.overlayed.set(true);
			}
			if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
				setTimeout(() => {
					this.overlayed.set(false);
				});
			}
		});
	}

	private getSubSection(event: Event): string {
		if (event instanceof NavigationStart) {
			const segments = event.url.split('/').filter(Boolean);
			if (segments[0] !== undefined && segments[0] !== 'crew' && segments[0] !== 'system') return this.active_sub_section();
			return segments[0] || 'home';
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
