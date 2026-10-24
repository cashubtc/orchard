/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/* Native Dependencies */
import {readinessLabel, statusLabel, syncLabel} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {OrchardFederationLocalStatus} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-consensus',
	templateUrl: './federation-consensus.component.html',
	styleUrl: '../federation-dashboard/federation-panels.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationConsensusComponent {
	public readonly statusLabel = statusLabel;
	public readonly syncLabel = syncLabel;
	public readonly readinessLabel = readinessLabel;

	public readonly local = input<OrchardFederationLocalStatus | null>(null);

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
					!['PAYMENT_OBSERVATION_REPORT_ACTION_INSPECT', 'PAYMENT_OBSERVATION_REPORT_ACTION_NONE'].includes(
						report.recommended_action,
					),
			) ?? [],
	);
}
