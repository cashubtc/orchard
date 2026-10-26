/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';

/* Native Dependencies */
import {FEDERATION_SETUP_STEPS} from '@client/modules/federation/constants/federation.constants';

@Component({
	selector: 'orc-federation-setup-start',
	imports: [MatIconModule],
	templateUrl: './federation-setup-start.component.html',
	styleUrls: ['../federation-setup/federation-setup-shared.scss', './federation-setup-start.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupStartComponent {
	public readonly steps = FEDERATION_SETUP_STEPS;

	public readonly admin = input<boolean>(false);
	public readonly chosen = output<'create' | 'join'>();
}
