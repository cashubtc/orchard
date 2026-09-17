/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
import {MintDatabaseInfo} from '@client/modules/mint/classes/mint-database-info.class';

@Component({
	selector: 'orc-mint-general-keysets',
	standalone: false,
	templateUrl: './mint-general-keysets.component.html',
	styleUrl: './mint-general-keysets.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralKeysetsComponent {
	public keysets = input.required<MintKeyset[]>();
	public keysets_counts = input.required<MintKeysetCount[]>();
	public database_info = input<MintDatabaseInfo | null>(null);

	/** Number of active keysets. */
	public active_count = computed(() => {
		return this.keysets().filter((k) => k.active).length;
	});

	/** Number of inactive keysets. */
	public inactive_count = computed(() => {
		return this.keysets().length - this.active_count();
	});

	/** Percentage of keysets that are active (0-100). */
	public active_percentage = computed(() => {
		const total = this.keysets().length;
		if (total === 0) return 0;
		return (this.active_count() / total) * 100;
	});

	/** Deduplicated list of units from keysets. */
	public unique_units = computed<string[]>(() => {
		const units = this.keysets().map((k) => k.unit);
		return [...new Set(units)];
	});

	/** Set of keyset IDs where the keyset is active. */
	public active_keyset_ids = computed<Set<string>>(() => {
		return new Set(
			this.keysets()
				.filter((k) => k.active)
				.map((k) => k.id),
		);
	});

	/** Total promise_count across all keysets. */
	public total_promises = computed(() => {
		return this.keysets_counts().reduce((sum, kc) => sum + kc.promise_count, 0);
	});

	/** Total proof_count across all keysets. */
	public total_proofs = computed(() => {
		return this.keysets_counts().reduce((sum, kc) => sum + kc.proof_count, 0);
	});

	/** Sum of promise_count for active keysets only. */
	public active_promises = computed(() => {
		const active_ids = this.active_keyset_ids();
		return this.keysets_counts()
			.filter((kc) => active_ids.has(kc.id))
			.reduce((sum, kc) => sum + kc.promise_count, 0);
	});

	/** Sum of proof_count for active keysets only. */
	public active_proofs = computed(() => {
		const active_ids = this.active_keyset_ids();
		return this.keysets_counts()
			.filter((kc) => active_ids.has(kc.id))
			.reduce((sum, kc) => sum + kc.proof_count, 0);
	});

	/** Percentage of promises from active keysets (0-100). */
	public active_promises_percentage = computed(() => {
		const total = this.total_promises();
		if (total === 0) return 0;
		return (this.active_promises() / total) * 100;
	});

	/** Percentage of proofs from active keysets (0-100). */
	public active_proofs_percentage = computed(() => {
		const total = this.total_proofs();
		if (total === 0) return 0;
		return (this.active_proofs() / total) * 100;
	});
}
