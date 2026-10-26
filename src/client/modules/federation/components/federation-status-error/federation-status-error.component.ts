/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/* Application Dependencies */
import {OrcErrorModule} from '@client/modules/error/error.module';
import type {OrchardError} from '@client/modules/error/types/error.types';

@Component({
	selector: 'orc-federation-status-error',
	imports: [OrcErrorModule],
	template: `@if (error(); as failure) {
		<section class="orc-error-card p-1" role="alert" [attr.aria-label]="source() + ' refresh error'">
			<strong>{{ source() }} could not be refreshed. Any retained values may be stale.</strong>
			<orc-error-resolve [error]="failure"></orc-error-resolve>
		</section>
	}`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationStatusErrorComponent {
	public readonly error = input<OrchardError | null | undefined>(null);
	public readonly source = input.required<string>();
}
