/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Router} from '@angular/router';

/* Vendor Dependencies */
import {Subscription} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {formatOrchardError, toConnectionError} from '@client/modules/error/helpers/error.helpers';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';

@Component({
	selector: 'orc-federation-setup',
	imports: [MatButtonModule, MatIconModule],
	templateUrl: './federation-setup.component.html',
	styleUrl: './federation-setup.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupComponent implements OnInit, OnDestroy {
	private readonly federationService = inject(FederationService);
	private readonly router = inject(Router);

	public readonly mode = this.federationService.mode;
	public readonly details = this.federationService.details;
	public readonly loading = signal(false);
	public readonly error = signal<string | null>(null);

	private readonly subscriptions = new Subscription();

	/** The guard has usually just probed; only check when this page is opened directly. */
	public ngOnInit(): void {
		const mode = this.mode();
		if (mode === 'member' || mode === 'standalone') void this.router.navigate(['/mint']);
		else if (mode === null) this.refresh();
	}

	/* *******************************************************
        Actions
    ******************************************************** */

	/** Re-probe after setup activation without attempting unavailable mint queries. */
	public refresh(): void {
		if (this.loading()) return;
		this.loading.set(true);
		this.error.set(null);
		this.subscriptions.add(
			this.federationService.loadMode(true).subscribe({
				next: ({mode}) => {
					this.loading.set(false);
					if (mode === 'member' || mode === 'standalone') void this.router.navigate(['/mint']);
				},
				error: (error: unknown) => {
					this.loading.set(false);
					const orchard_error = (error instanceof OrchardErrors && error.errors[0]) || toConnectionError(error);
					this.error.set(formatOrchardError(orchard_error).description);
				},
			}),
		);
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Cancel pending requests when leaving the setup page. */
	public ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
