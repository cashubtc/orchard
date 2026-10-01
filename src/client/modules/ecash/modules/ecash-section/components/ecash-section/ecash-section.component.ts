/* Core Dependencies */
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	OnInit,
	ViewContainerRef,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import {ActivatedRoute, Event, NavigationStart, Router} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
import {MatSidenav} from '@angular/material/sidenav';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {deviceTypeFromBreakpoints} from '@client/modules/layout/helpers/device.helpers';

@Component({
	selector: 'orc-ecash-section',
	standalone: false,
	templateUrl: './ecash-section.component.html',
	styleUrl: './ecash-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashSectionComponent implements OnInit, AfterViewInit, OnDestroy {
	private readonly configService = inject(ConfigService);
	private readonly navService = inject(NavService);
	private readonly formPanelService = inject(FormPanelService);
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly menu_items: NavSecondaryItem[] = this.navService.getMenuItems('ecash');

	public readonly version = signal<string>(this.configService.config.mode.version);
	public readonly active_sub_section = signal<string>('');
	public readonly device_type = signal<DeviceType>('desktop');

	private readonly formSidenav = viewChild<MatSidenav>('formSidenav');
	private readonly formPanelHost = viewChild('formPanelHost', {read: ViewContainerRef});

	/** Mobile devices get panels in a bottom sheet instead of the sidenav */
	private readonly sheet = computed(() => this.device_type() === 'mobile');

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.subscriptions.add(this.getRouterSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.subscriptions.add(this.getPanelSubscription());
	}

	ngAfterViewInit(): void {
		const host = this.formPanelHost();
		if (host) this.formPanelService.registerContainer(host, {sheet: this.sheet});
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	/** Tracks the active subsection so its nav item is highlighted, and closes any open panel on navigation */
	private getRouterSubscription(): Subscription {
		return this.router.events.pipe(filter((event: Event) => 'routerEvent' in event || 'type' in event)).subscribe((event) => {
			if (event instanceof NavigationStart) this.formPanelService.close();
			this.active_sub_section.set(this.getSubSection(event));
		});
	}

	/** Observes viewport breakpoints and updates the device type */
	private getBreakpointSubscription(): Subscription {
		return this.breakpointObserver
			.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
			.subscribe((result) => this.device_type.set(deviceTypeFromBreakpoints(result)));
	}

	/** Syncs the sidenav open/close state with the FormPanelService */
	private getPanelSubscription(): Subscription {
		const sub = new Subscription();
		sub.add(this.formPanelService.afterOpened().subscribe(() => this.formSidenav()?.open()));
		sub.add(this.formPanelService.afterClosed().subscribe(() => this.formSidenav()?.close()));
		return sub;
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
		if (route.snapshot.data['sub_section'] === 'error') return route.snapshot.data['origin'] || '';
		return route.snapshot.data['sub_section'] || '';
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Closes the panel when the sidenav is dismissed by backdrop click or escape */
	public onSidenavClosed(): void {
		this.formPanelService.close();
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
