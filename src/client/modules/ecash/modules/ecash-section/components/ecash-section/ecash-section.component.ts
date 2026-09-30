/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal} from '@angular/core';
import {ActivatedRoute, Event, NavigationStart, Router} from '@angular/router';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';

@Component({
	selector: 'orc-ecash-section',
	standalone: false,
	templateUrl: './ecash-section.component.html',
	styleUrl: './ecash-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashSectionComponent implements OnInit, OnDestroy {
	private readonly configService = inject(ConfigService);
	private readonly navService = inject(NavService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly menu_items: NavSecondaryItem[] = this.navService.getMenuItems('ecash');

	public readonly version = signal<string>(this.configService.config.mode.version);
	public readonly active_sub_section = signal<string>('');

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.subscriptions.add(this.getRouterSubscription());
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	/** Tracks the active subsection so its nav item is highlighted */
	private getRouterSubscription(): Subscription {
		return this.router.events.pipe(filter((event: Event) => 'routerEvent' in event || 'type' in event)).subscribe((event) => {
			this.active_sub_section.set(this.getSubSection(event));
		});
	}

	/** The subsection an in-flight or finished navigation lands on */
	private getSubSection(event: Event): string {
		if (event instanceof NavigationStart) {
			const segments = event.url.split('/').filter(Boolean);
			if (segments[0] !== 'ecash') return this.active_sub_section();
			return segments[1] || 'wallet';
		}

		const router_event = 'routerEvent' in event ? event.routerEvent : event;
		if (router_event.type !== 1) return this.active_sub_section();
		let route = this.route.root;
		while (route.firstChild) {
			route = route.firstChild;
		}
		return route.snapshot.data['sub_section'] || '';
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
