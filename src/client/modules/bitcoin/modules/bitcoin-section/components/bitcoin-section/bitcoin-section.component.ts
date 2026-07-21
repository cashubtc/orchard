/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, WritableSignal} from '@angular/core';
import {Router, Event, ActivatedRoute, NavigationStart, NavigationEnd, NavigationCancel, NavigationError} from '@angular/router';
/* Vendor Dependencies */
import {filter, Subscription} from 'rxjs';
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
	public bitcoin_blockchain_info: WritableSignal<BitcoinBlockchainInfo | null> = signal(null);
	public bitcoin_network_info: WritableSignal<BitcoinNetworkInfo | null> = signal(null);
	public active_sub_section: WritableSignal<string> = signal('');
	public overlayed: WritableSignal<boolean> = signal(false);

	private subscriptions: Subscription = new Subscription();

	constructor(
		private bitcoinService: BitcoinService,
		private router: Router,
		private route: ActivatedRoute,
	) {}

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
