/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal} from '@angular/core';
import {ClipboardModule} from '@angular/cdk/clipboard';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';

/* Shared Dependencies */
import type {OrchardFederationSetupReview} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-setup-review',
	imports: [ClipboardModule, MatButtonModule, MatCheckboxModule],
	templateUrl: './federation-setup-review.component.html',
	styleUrl: '../federation-setup/federation-setup-forms.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupReviewComponent {
	public readonly proposal = input.required<OrchardFederationSetupReview>();
	public readonly member_id = input<number | null>(null);
	public readonly approved_members = input<number[]>([]);
	public readonly busy = input(false);
	public readonly approve = output<string>();

	public readonly copied = signal(false);

	/** Resets whenever a different proposal arrives, so a changed proposal needs a fresh review. */
	public readonly confirmations = linkedSignal<OrchardFederationSetupReview, Record<number, boolean>>({
		source: this.proposal,
		computation: () => ({}),
	});
	public readonly checked_count = computed(() => this.proposal().members.filter((member) => this.isChecked(member.member_id)).length);
	public readonly already_approved = computed(() => this.member_id() !== null && this.approved_members().includes(this.member_id()!));
	public readonly ready = computed(
		() => this.proposal().members.length > 0 && this.checked_count() === this.proposal().members.length && !this.already_approved(),
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

	/** Emit only after every displayed fingerprint, including our own, was checked. */
	public submit(): void {
		if (this.ready() && !this.busy()) this.approve.emit(this.proposal().proposal_hash);
	}
}
