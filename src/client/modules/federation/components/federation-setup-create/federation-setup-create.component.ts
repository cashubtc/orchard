/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {COMMA, ENTER} from '@angular/cdk/keycodes';

/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatChipsModule, type MatChipEditedEvent, type MatChipInputEvent} from '@angular/material/chips';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSliderModule} from '@angular/material/slider';

/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';

/* Native Dependencies */
import {parseAmounts, powerAmounts, setupKeysetSummary, setupThresholds} from '@client/modules/federation/helpers/federation-setup.helpers';
import {
	FEDERATION_INVITATION_DEFAULT_LIFETIME,
	FEDERATION_INVITATION_LIFETIMES,
	FEDERATION_NETWORK_CAPTIONS,
	FEDERATION_NETWORK_LABELS,
	FEDERATION_NETWORKS,
	FEDERATION_SETUP_AMOUNTS,
	FEDERATION_SETUP_MEMBERS,
} from '@client/modules/federation/constants/federation.constants';
import type {FederationSetupThresholds} from '@client/modules/federation/types/federation-setup.types';

/* Shared Dependencies */
import type {FederationSetupCreateInput} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-create',
	imports: [
		FormsModule,
		NgTemplateOutlet,
		MatButtonModule,
		MatCardModule,
		MatCheckboxModule,
		MatChipsModule,
		MatDatepickerModule,
		MatDividerModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatSliderModule,
		OrcFormModule,
		OrcGraphicModule,
		OrcLocalModule,
		OrcMintGeneralModule,
	],
	templateUrl: './federation-setup-create.component.html',
	styleUrls: ['../federation-setup/federation-setup-shared.scss', './federation-setup-create.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupCreateComponent {
	public readonly busy = input<boolean>(false);
	public readonly create = output<FederationSetupCreateInput>();
	public readonly cancel = output<void>();

	public readonly networks = FEDERATION_NETWORKS;
	public readonly network_labels = FEDERATION_NETWORK_LABELS;
	public readonly network_captions = FEDERATION_NETWORK_CAPTIONS;
	public readonly lifetimes = FEDERATION_INVITATION_LIFETIMES;
	public readonly member_limits = FEDERATION_SETUP_MEMBERS;
	public readonly amount_limit = FEDERATION_SETUP_AMOUNTS.max;
	public readonly separator_keys = [ENTER, COMMA] as const;
	public readonly today: DateTime = DateTime.now();

	public readonly members = signal<number>(FEDERATION_SETUP_MEMBERS.initial);
	/** Null follows the default for the member count until the operator changes it. */
	public readonly signing = signal<number | null>(null);
	public readonly observation = signal<number | null>(null);
	public readonly network = signal<string>('signet');
	public readonly unit = signal<string>('sat');
	public readonly fee = signal<string>('0');
	public readonly expiry = signal<DateTime | null>(null);
	public readonly default_amounts = signal<boolean>(true);
	public readonly amount_count = signal<number>(FEDERATION_SETUP_AMOUNTS.initial);
	public readonly custom_amounts = signal<string[]>([]);
	public readonly lifetime = signal<number>(FEDERATION_INVITATION_DEFAULT_LIFETIME);
	public readonly public_url = signal<string>('');
	public readonly federation_url = signal<string>('');
	public readonly coordinator_url = signal<string>('');
	public readonly allow_local = signal<boolean>(false);
	public readonly advanced = signal<boolean>(false);
	public readonly help = signal<string | null>(null);

	public readonly rules = computed<FederationSetupThresholds>(() => setupThresholds(this.members()));
	public readonly threshold = computed<number>(() => this.signing() ?? this.rules().sign_default);
	public readonly payment_checks = computed<number>(() => this.observation() ?? this.rules().payment_default);
	public readonly customised = computed<boolean>(() => this.signing() !== null || this.observation() !== null);
	public readonly signing_range = computed<string>(() =>
		this.rangeText(this.rules().sign_min, this.rules().sign_max, this.rules().sign_default),
	);
	public readonly payment_range = computed<string>(() =>
		this.rangeText(this.rules().payment_min, this.rules().payment_max, this.rules().payment_default),
	);
	public readonly offline = computed<number>(() => Math.min(this.rules().faulty, this.members() - this.payment_checks()));
	public readonly offline_copy = computed<string>(() => {
		const offline = this.offline();
		if (offline === 0) return 'Every member must stay online for the federation to run.';
		return `The federation keeps running with up to ${offline} ${offline === 1 ? 'member' : 'members'} offline.`;
	});
	public readonly amounts = computed<string[]>(() =>
		this.default_amounts() ? powerAmounts(this.amount_count()) : this.custom_amounts(),
	);
	public readonly amount_range = computed<string>(() => {
		const amounts = this.amounts();
		if (!amounts.length) return 'No amounts';
		return `${amounts.length} ${amounts.length === 1 ? 'amount' : 'amounts'}, ${amounts[0]} to ${amounts.at(-1)}`;
	});
	/** The preview chip shows a fee only once the field holds a whole number. */
	public readonly fee_ppk = computed<number>(() => (/^\d+$/.test(this.fee().trim()) ? Number(this.fee().trim()) : 0));
	public readonly lifetime_label = computed<string>(
		() => this.lifetimes.find((item) => item.seconds === this.lifetime())?.label ?? `${this.lifetime()} seconds`,
	);
	public readonly valid = computed<boolean>(() => !!this.unit().trim() && !!this.fee().trim() && this.amounts().length > 0);
	public readonly keyset_summary = computed<string>(() => setupKeysetSummary(this.unit(), this.amounts(), this.fee()));

	/* *******************************************************
        Thresholds
    ******************************************************** */

	/** A new member count resets both thresholds to that count's defaults. */
	public changeMembers(delta: number): void {
		this.members.set(this.clamp(this.members() + delta, this.member_limits.min, this.member_limits.max));
		this.resetThresholds();
	}

	/** Step the signing threshold within cdk's range for the member count. */
	public changeSigning(delta: number): void {
		this.signing.set(this.clamp(this.threshold() + delta, this.rules().sign_min, this.rules().sign_max));
	}

	/** Step the payment checks within cdk's range for the member count. */
	public changePayment(delta: number): void {
		this.observation.set(this.clamp(this.payment_checks() + delta, this.rules().payment_min, this.rules().payment_max));
	}

	/** Return both thresholds to the defaults for the member count. */
	public resetThresholds(): void {
		this.signing.set(null);
		this.observation.set(null);
	}

	/** Open one field's help, or close it when it's already open. */
	public toggleHelp(key: string): void {
		this.help.update((current) => (current === key ? null : key));
	}

	/* *******************************************************
        Amounts
    ******************************************************** */

	/** Unticking powers of two keeps the current amounts as an editable list. */
	public setDefaultAmounts(checked: boolean): void {
		if (!checked) this.custom_amounts.set(this.amounts());
		this.default_amounts.set(checked);
	}

	/** Add typed or pasted whole amounts, keeping the list unique and within cdk's limit. */
	public addAmount(event: MatChipInputEvent): void {
		const added = parseAmounts(event.value).filter((amount) => /^\d+$/.test(amount) && amount !== '0');
		this.custom_amounts.update((amounts) => [...new Set([...amounts, ...added])].slice(0, this.amount_limit));
		event.chipInput.clear();
	}

	/** Remove one amount from the editable list. */
	public removeAmount(amount: string): void {
		this.custom_amounts.update((amounts) => amounts.filter((item) => item !== amount));
	}

	/** Replace an edited amount, or remove it when the edit isn't a positive whole number. */
	public editAmount(amount: string, event: MatChipEditedEvent): void {
		const value = event.value.trim();
		if (!/^\d+$/.test(value) || /^0+$/.test(value)) return this.removeAmount(amount);
		this.custom_amounts.update((amounts) => amounts.map((item) => (item === amount ? value : item)));
	}

	/* *******************************************************
        Actions Up
    ******************************************************** */

	/** Emit the form; the mint validates the values and its refusal reaches the operator as-is. */
	public submit(): void {
		if (!this.valid() || this.busy()) return;
		const expiry = this.expiry();
		this.create.emit({
			members: this.members(),
			threshold: this.threshold(),
			network: this.network(),
			payment_observation_threshold: this.payment_checks(),
			invitation_lifetime_secs: String(this.lifetime()),
			allow_insecure_localhost: this.allow_local(),
			keyset: {
				unit: this.unit().trim(),
				amounts: this.amounts(),
				input_fee_ppk: this.fee().trim(),
				final_expiry: expiry ? String(expiry.endOf('day').toUnixInteger()) : undefined,
			},
			public_mint_url: this.public_url().trim() || undefined,
			federation_api_url: this.federation_url().trim() || undefined,
			coordinator_url: this.coordinator_url().trim() || undefined,
		});
	}

	/** "2 to 4 · default 3", or "Fixed at 2" when there's no choice. */
	private rangeText(min: number, max: number, fallback: number): string {
		return min === max ? `Fixed at ${min}` : `${min} to ${max} · default ${fallback}`;
	}

	/** Keep a stepped value inside its range. */
	private clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
}
