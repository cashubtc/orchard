/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/* Application Dependencies */
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {FederationStatusErrorComponent} from '@client/modules/federation/components/federation-status-error/federation-status-error.component';
import {FederationCountPipe} from '@client/modules/federation/pipes/federation-count/federation-count.pipe';
import {FederationDurationPipe} from '@client/modules/federation/pipes/federation-duration/federation-duration.pipe';
import {readinessLabel, statusLabel, syncLabel} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {OrchardFederationLocalStatus} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-consensus',
	imports: [OrcButtonModule, OrcDataModule, FederationStatusErrorComponent, FederationCountPipe, FederationDurationPipe],
	templateUrl: './federation-consensus.component.html',
	styleUrl: '../federation-dashboard/federation-panels.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationConsensusComponent {
	public readonly statusLabel = statusLabel;
	public readonly syncLabel = syncLabel;
	public readonly readinessLabel = readinessLabel;

	public readonly local = input<OrchardFederationLocalStatus | null>(null);

	public readonly loading = input<boolean>(false);
	public readonly error = input<OrchardError | null | undefined>(null);

	public readonly status = computed(() => this.local()?.status);
	public readonly inspections = computed(
		() =>
			this.status()?.payment_observations?.reports.filter(
				(report) => report.recommended_action === 'PAYMENT_OBSERVATION_REPORT_ACTION_INSPECT',
			) ?? [],
	);
	public readonly unknown_actions = computed(
		() =>
			this.status()?.payment_observations?.reports.filter(
				(report) =>
					report.recommended_action != null &&
					!['PAYMENT_OBSERVATION_REPORT_ACTION_INSPECT', 'PAYMENT_OBSERVATION_REPORT_ACTION_NONE'].includes(
						report.recommended_action,
					),
			) ?? [],
	);
}
