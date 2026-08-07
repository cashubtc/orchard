/* Core Dependencies */
import {ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy} from '@angular/core';
import {Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError} from '@angular/router';
/* Vendor Dependencies */
import {Subscription} from 'rxjs';

@Component({
	selector: 'orc-auth-section',
	standalone: false,
	templateUrl: './auth-section.component.html',
	styleUrl: './auth-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSectionComponent implements OnInit, OnDestroy {
	public overlayed = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();

	constructor(private router: Router) {}

	ngOnInit(): void {
		this.subscriptions.add(this.getOverlaySubscription());
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
				if (segments[0] === 'auth') this.overlayed.set(true);
			}
			if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
				setTimeout(() => {
					this.overlayed.set(false);
				});
			}
		});
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
