/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject} from '@angular/core';
import {Router, Event, ActivatedRoute, NavigationStart, NavigationEnd, NavigationCancel, NavigationError} from '@angular/router';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';
/* Native Dependencies */
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {BitcoinNetworkInfo} from '@client/modules/bitcoin/classes/bitcoin-network-info.class';
import {BitcoinBlockchainInfo} from '@client/modules/bitcoin/classes/bitcoin-blockchain-info.class';

@Component({
	selector: 'orc-bitcoin-section',
	standalone: false,
	templateUrl: './bitcoin-section.component.html',
	styleUrl: './bitcoin-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinSectionComponent implements OnInit, OnDestroy {
	private readonly navService = inject(NavService);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly menu_items: NavSecondaryItem[] = this.navService.getMenuItems('bitcoin');

	public bitcoin_blockchain_info = signal<BitcoinBlockchainInfo | null>(null);
	public bitcoin_network_info = signal<BitcoinNetworkInfo | null>(null);
	public active_sub_section = signal<string>('');
	public overlayed = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.bitcoinService.loadBitcoinNetworkInfo().subscribe({
			next: (info: BitcoinNetworkInfo) => {
				this.bitcoin_network_info.set(info);
			},
			error: (error) => {
				console.error(error);
			},
		});

		this.bitcoinService.loadBitcoinBlockchainInfo().subscribe();
		this.subscriptions.add(this.getBitcoinBlockchainInfoSubscription());
		this.subscriptions.add(this.getRouterSubscription());
		this.subscriptions.add(this.getOverlaySubscription());
	}

	private getBitcoinBlockchainInfoSubscription(): Subscription {
		return this.bitcoinService.bitcoin_blockchain_info$.subscribe((info: BitcoinBlockchainInfo | null) => {
			if (info) this.bitcoin_blockchain_info.set(info);
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
				if (segments[0] === 'bitcoin') this.overlayed.set(true);
			}
			if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
				this.overlayed.set(false);
			}
		});
	}

	private getSubSection(event: Event): string {
		if (event instanceof NavigationStart) {
			const segments = event.url.split('/').filter(Boolean);
			if (segments[0] !== 'bitcoin') return this.active_sub_section();
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
