/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {OrcDataModule} from '@client/modules/data/data.module';

/* Native Dependencies */
import {statusLabel} from '@client/modules/federation/helpers/federation-status.helpers';
import {FEDERATION_DKG_STAGE_ICONS, FEDERATION_DKG_STAGES} from '@client/modules/federation/constants/federation.constants';
import type {FederationSetupStage} from '@client/modules/federation/types/federation-setup.types';
import {FederationCountPipe} from '@client/modules/federation/pipes/federation-count/federation-count.pipe';

/* Shared Dependencies */
import type {OrchardFederationSetupDkg} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-keygen',
	imports: [MatButtonModule, MatCardModule, MatDividerModule, MatIconModule, OrcDataModule, FederationCountPipe],
	templateUrl: './federation-setup-keygen.component.html',
	styleUrls: ['../federation-setup/federation-setup-shared.scss', './federation-setup-keygen.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupKeygenComponent {
	public readonly statusLabel = statusLabel;
	public readonly stage_icons = FEDERATION_DKG_STAGE_ICONS;

	public readonly dkg = input<OrchardFederationSetupDkg | null>(null);
	public readonly member_count = input<number>(0);
	public readonly locked = input<boolean>(false);
	public readonly activate = output<void>();

	public readonly members = computed<number[]>(() => Array.from({length: this.member_count()}, (_, index) => index + 1));
	public readonly ready = computed<boolean>(() => !!this.dkg()?.finalized_ready);
	/** Without totals from the mint, a stage is done once the configuration is final and in progress once it has a count. */
	public readonly stages = computed<FederationSetupStage[]>(() => {
		const dkg = this.dkg();
		if (!dkg) return [];
		return FEDERATION_DKG_STAGES.map(({field, label}) => {
			const count = String(dkg[field] ?? '0');
			const state = dkg.finalized_ready ? 'done' : count !== '0' ? 'active' : 'pending';
			return {label, count, state};
		});
	});
}
