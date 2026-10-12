/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatusPill} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-mints',
	standalone: false,
	templateUrl: './ecash-general-mints.component.html',
	styleUrl: './ecash-general-mints.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintsComponent {
	public readonly mints = input.required<EcashMint[]>();
	public readonly statuses = input<EcashMintStatus[]>([]);
	public readonly balances = input<EcashBalance[]>([]);
	public readonly reserves = input<MintReserves | null>(null);
	public readonly loading = input<boolean>(false);
	public readonly loading_statuses = input<boolean>(false);

	/** The Orchard mint first, then the rest in the order they were added, each with its balances, status and, for Orchard, reserves */
	public readonly rows = computed(() => {
		const balances = this.balances();
		return [...this.mints()]
			.sort((a, b) => Number(b.is_orchard) - Number(a.is_orchard) || a.created_at - b.created_at)
			.map((mint) => ({
				mint,
				balances: balances.filter((balance) => balance.mint_id === mint.id),
				status: this.getStatus(mint.id),
				reserves: mint.is_orchard ? this.reserves() : null,
			}));
	});

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Status dot and text: checking until statuses load, then online with latency or unreachable with the reason */
	private getStatus(mint_id: string): EcashMintStatusPill {
		if (this.loading_statuses()) return {state: 'loading', text: 'Checking', error: null};
		const status = this.statuses().find((status) => status.mint_id === mint_id);
		if (!status) return {state: 'disabled', text: 'Unknown', error: null};
		if (status.online) {
			const latency = status.latency_ms === null ? '' : ` · ${status.latency_ms} ms`;
			return {state: 'active', text: `Online${latency}`, error: null};
		}
		return {state: 'inactive', text: 'Unreachable', error: status.error};
	}
}
