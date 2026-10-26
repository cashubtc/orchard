/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal} from '@angular/core';
import {ClipboardModule} from '@angular/cdk/clipboard';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcDataModule} from '@client/modules/data/data.module';

/* Native Dependencies */
import {
	displayFingerprint,
	setupKeysetSummary,
	setupMemberList,
	setupPaymentRule,
	setupUrlHost,
} from '@client/modules/federation/helpers/federation-setup.helpers';
import {timestamp} from '@client/modules/federation/helpers/federation-status.helpers';
import {FEDERATION_NETWORK_LABELS} from '@client/modules/federation/constants/federation.constants';

/* Shared Dependencies */
import type {OrchardFederationSetupReview} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-review',
	imports: [
		ClipboardModule,
		MatButtonModule,
		MatCardModule,
		MatCheckboxModule,
		MatDividerModule,
		MatIconModule,
		MatProgressBarModule,
		OrcLocalModule,
		OrcDataModule,
	],
	templateUrl: './federation-setup-review.component.html',
	styleUrls: ['../federation-setup/federation-setup-shared.scss', './federation-setup-review.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupReviewComponent {
	public readonly proposal = input.required<OrchardFederationSetupReview>();
	public readonly member_id = input<number | null>(null);
	public readonly approved_members = input<number[]>([]);
	public readonly busy = input<boolean>(false);
	public readonly approve = output<string>();

	public readonly displayFingerprint = displayFingerprint;
	public readonly hostOf = setupUrlHost;

	public readonly copied = signal<boolean>(false);

	public readonly payment_rule = computed<string>(() => setupPaymentRule(this.proposal().details_json));
	public readonly keysets = computed(() =>
		this.proposal().keysets.map((keyset) => ({
			summary: setupKeysetSummary(keyset.unit, keyset.amounts, keyset.input_fee_ppk),
			expiry: timestamp(keyset.final_expiry),
		})),
	);
	public readonly short_hash = computed<string>(() => this.proposal().proposal_hash.slice(0, 8));
	public readonly approved_text = computed<string>(() => setupMemberList(this.approved_members()));
	public readonly waiting_text = computed<string>(() =>
		setupMemberList(
			this.proposal()
				.members.map((member) => member.member_id)
				.filter((member_id) => !this.approved_members().includes(member_id)),
		),
	);
	public readonly network_label = computed<string>(() => FEDERATION_NETWORK_LABELS[this.proposal().network] ?? this.proposal().network);
	public readonly other_members = computed(() => this.proposal().members.filter((member) => member.member_id !== this.member_id()));

	/** Resets whenever a different proposal arrives, so a changed proposal needs a fresh review. */
	public readonly confirmations = linkedSignal<OrchardFederationSetupReview, Record<number, boolean>>({
		source: this.proposal,
		computation: () => ({}),
	});
	public readonly checked_count = computed(() => this.other_members().filter((member) => this.isChecked(member.member_id)).length);
	public readonly checked_percent = computed(() =>
		this.other_members().length ? (this.checked_count() / this.other_members().length) * 100 : 100,
	);
	public readonly already_approved = computed(() => this.member_id() !== null && this.approved_members().includes(this.member_id()!));
	public readonly ready = computed(
		() => this.proposal().members.length > 0 && this.checked_count() === this.other_members().length && !this.already_approved(),
	);

	/* *******************************************************
        Review
    ******************************************************** */

	/** Whether this member was checked for the currently displayed proposal. */
	public isChecked(member_id: number): boolean {
		return !!this.confirmations()[member_id];
	}

	/** Record an explicit operator confirmation without persisting it. */
	public setChecked(member_id: number, checked: boolean): void {
		this.confirmations.update((values) => ({...values, [member_id]: checked}));
	}

	/** Emit only after every other operator’s fingerprint was checked. */
	public submit(): void {
		if (this.ready() && !this.busy()) this.approve.emit(this.proposal().proposal_hash);
	}
}
