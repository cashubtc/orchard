/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';

/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';

/* Native Dependencies */
import {parseAmounts} from '@client/modules/federation/helpers/federation-setup.helpers';
import {FEDERATION_NETWORKS} from '@client/modules/federation/constants/federation.constants';

/* Shared Dependencies */
import type {FederationSetupCreateInput} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-create',
	imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, OrcFormModule],
	templateUrl: './federation-setup-create.component.html',
	styleUrl: '../federation-setup/federation-setup-forms.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupCreateComponent {
	public readonly busy = input(false);
	public readonly create = output<FederationSetupCreateInput>();
	public readonly cancel = output<void>();
	public readonly networks = FEDERATION_NETWORKS;

	public readonly members = signal(5);
	public readonly threshold = signal(3);
	public readonly observation = signal<number | null>(null);
	public readonly network = signal('signet');
	public readonly unit = signal('sat');
	public readonly fee = signal('0');
	public readonly expiry = signal('');
	public readonly amounts_text = signal('1, 2, 4, 8, 16, 32, 64, 128');
	public readonly public_url = signal('');
	public readonly federation_url = signal('');
	public readonly coordinator_url = signal('');
	public readonly allow_local = signal(false);

	public readonly consensus = computed(() => this.members() - Math.floor((this.members() - 1) / 3));
	public readonly payment_checks = computed(() =>
		Math.min(this.members(), Math.max(this.consensus(), this.observation() ?? this.consensus())),
	);
	public readonly offline = computed(() => Math.min(this.members() - this.threshold(), this.members() - this.payment_checks()));
	public readonly amounts = computed(() => parseAmounts(this.amounts_text()));
	public readonly valid = computed(() => !!this.unit().trim() && !!this.fee().trim() && this.amounts().length > 0);

	/* *******************************************************
        Actions Up
    ******************************************************** */

	/** Keep the member and signing controls within their displayed bounds. */
	public changeMembers(delta: number): void {
		this.members.update((value) => Math.max(1, Math.min(15, value + delta)));
		this.threshold.update((value) => Math.min(value, this.members()));
	}

	/** Emit the form; the mint validates the values and its refusal reaches the operator as-is. */
	public submit(): void {
		if (!this.valid() || this.busy()) return;
		this.create.emit({
			members: this.members(),
			threshold: this.threshold(),
			network: this.network(),
			payment_observation_threshold: this.payment_checks(),
			allow_insecure_localhost: this.allow_local(),
			keyset: {
				unit: this.unit().trim(),
				amounts: this.amounts(),
				input_fee_ppk: this.fee().trim(),
				final_expiry: this.expiry().trim() || undefined,
			},
			public_mint_url: this.public_url().trim() || undefined,
			federation_api_url: this.federation_url().trim() || undefined,
			coordinator_url: this.coordinator_url().trim() || undefined,
		});
	}
}
