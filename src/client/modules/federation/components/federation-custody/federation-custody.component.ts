/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';

/* Native Dependencies */
import {hasOnchainCustody, statusLabel, timestamp} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {OrchardFederationCustodyStatus} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-custody',
	imports: [OrcLocalModule],
	templateUrl: './federation-custody.component.html',
	styleUrl: '../federation-dashboard/federation-panels.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationCustodyComponent {
	public readonly statusLabel = statusLabel;
	public readonly timestamp = timestamp;

	public readonly custody = input<OrchardFederationCustodyStatus | null>(null);

	public readonly onchain = computed(() => hasOnchainCustody(this.custody()));
	public readonly no_custody = computed(() => !!this.custody() && !this.onchain() && !this.custody()?.bark);
}
