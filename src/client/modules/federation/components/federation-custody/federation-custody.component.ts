/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/* Application Dependencies */
import {OrcBitcoinGeneralBlockPipeModule} from '@client/modules/bitcoin/modules/bitcoin-general/bitcoin-general-block-pipe.module';
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {FederationStatusErrorComponent} from '@client/modules/federation/components/federation-status-error/federation-status-error.component';
import {FederationCountPipe} from '@client/modules/federation/pipes/federation-count/federation-count.pipe';
import {
	hasNoCustody,
	hasOnchainCustody,
	paymentRule,
	statusLabel,
	timestamp,
} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {OrchardFederationInfo, OrchardFederationCustodyStatus} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-custody',
	imports: [
		OrcBitcoinGeneralBlockPipeModule,
		OrcButtonModule,
		OrcDataModule,
		OrcLocalModule,
		FederationStatusErrorComponent,
		FederationCountPipe,
	],
	templateUrl: './federation-custody.component.html',
	styleUrl: '../federation-dashboard/federation-panels.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationCustodyComponent {
	public readonly statusLabel = statusLabel;
	public readonly timestamp = timestamp;
	public readonly paymentRule = paymentRule;

	public readonly info = input<OrchardFederationInfo | null>(null);
	public readonly custody = input<OrchardFederationCustodyStatus | null>(null);
	public readonly loading = input<boolean>(false);
	public readonly error = input<OrchardError | null | undefined>(null);

	public readonly onchain = computed(() => hasOnchainCustody(this.custody()));
	public readonly no_custody = computed(() => hasNoCustody(this.custody()));
	public readonly units = computed(() => [...new Set((this.info()?.keysets ?? []).map((keyset) => keyset.unit))].join(', '));
}
