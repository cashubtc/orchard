/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';
/* Native Dependencies */
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';

type EcashMintRow = {
	id: string;
	name: string;
	host: string;
	icon_url: string | null;
	is_orchard: boolean;
	balances: EcashBalance[];
	status: GraphicStatusState;
	status_text: string;
	status_error: string | null;
};

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
	public readonly loading = input<boolean>(false);
	public readonly loading_statuses = input<boolean>(false);

	/** The Orchard mint first, then the rest in the order they were added */
	public readonly rows = computed<EcashMintRow[]>(() => {
		const balances = this.balances();
		return [...this.mints()]
			.sort((a, b) => Number(b.is_orchard) - Number(a.is_orchard) || a.created_at - b.created_at)
			.map((mint) => ({
				id: mint.id,
				name: mint.display_name,
				host: mint.host,
				icon_url: mint.icon_url,
				is_orchard: mint.is_orchard,
				balances: balances.filter((balance) => balance.mint_id === mint.id && balance.balance > 0),
				...this.getStatus(mint.id),
			}));
	});

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Status dot and text: checking until statuses load, then online with latency or unreachable with the reason */
	private getStatus(mint_id: string): Pick<EcashMintRow, 'status' | 'status_text' | 'status_error'> {
		if (this.loading_statuses()) return {status: 'loading', status_text: 'Checking', status_error: null};
		const status = this.statuses().find((status) => status.mint_id === mint_id);
		if (!status) return {status: 'disabled', status_text: 'Unknown', status_error: null};
		if (status.online) {
			const latency = status.latency_ms === null ? '' : ` · ${status.latency_ms} ms`;
			return {status: 'active', status_text: `Online${latency}`, status_error: null};
		}
		return {status: 'inactive', status_text: 'Unreachable', status_error: status.error};
	}
}
