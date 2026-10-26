/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal} from '@angular/core';
import {TitleCasePipe} from '@angular/common';
import {ClipboardModule} from '@angular/cdk/clipboard';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';

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

/* Shared Dependencies */
import type {OrchardFederationSetupReview} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-review',
	imports: [ClipboardModule, TitleCasePipe, MatButtonModule, MatCheckboxModule, MatIconModule, OrcLocalModule, OrcDataModule],
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
	public readonly other_members = computed(() => this.proposal().members.filter((member) => member.member_id !== this.member_id()));

	/** Resets whenever a different proposal arrives, so a changed proposal needs a fresh review. */
	public readonly confirmations = linkedSignal<OrchardFederationSetupReview, Record<number, boolean>>({
		source: this.proposal,
		computation: () => ({}),
	});
	public readonly checked_count = computed(() => this.other_members().filter((member) => this.isChecked(member.member_id)).length);
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
