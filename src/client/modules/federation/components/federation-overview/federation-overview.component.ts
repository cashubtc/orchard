/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import type {MintInfo} from '@client/modules/mint/classes/mint-info.class';

/* Native Dependencies */
import {
	paymentBackend,
	paymentRule,
	readinessLabel,
	statusLabel,
	syncLabel,
	timestamp,
} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {
	OrchardFederationInfo,
	OrchardFederationMemberStatuses,
	OrchardFederationLocalStatus,
	OrchardFederationCustodyStatus,
} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-overview',
	imports: [OrcLocalModule, OrcMintGeneralModule],
	templateUrl: './federation-overview.component.html',
	styleUrls: ['../federation-dashboard/federation-panels.scss', './federation-overview.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationOverviewComponent {
	public readonly statusLabel = statusLabel;
	public readonly syncLabel = syncLabel;
	public readonly readinessLabel = readinessLabel;
	public readonly timestamp = timestamp;
	public readonly paymentRule = paymentRule;
	public readonly paymentBackend = paymentBackend;

	public readonly info = input<OrchardFederationInfo | null>(null);
	public readonly members = input<OrchardFederationMemberStatuses | null>(null);
	public readonly local = input<OrchardFederationLocalStatus | null>(null);
	public readonly custody = input<OrchardFederationCustodyStatus | null>(null);
	public readonly mint_info = input<MintInfo | null>(null);

	public readonly network = computed(() => this.custody()?.wallet_operator?.network ?? this.custody()?.bark?.network ?? 'Not reported');
	public readonly reachable = computed(() => this.members()?.members.filter((member) => member.reachable).length);
	public readonly rows = computed(() =>
		(this.info()?.members ?? []).map((member) => ({
			...member,
			result: this.members()?.members.find((result) => result.member_id === member.member_id),
			digest: this.digest(member.member_id),
		})),
	);
	public readonly methods = computed(() => {
		const nuts = this.mint_info()?.nuts;
		const policy = this.info()?.payment_observation_policy;
		return [
			{direction: 'Incoming', nut: nuts?.nut4, policy: policy?.mint_quotes},
			{direction: 'Outgoing', nut: nuts?.nut5, policy: policy?.melt_quotes},
		].flatMap(({direction, nut, policy}) =>
			(nut?.methods ?? []).map((method) => ({...method, direction, disabled: nut?.disabled, policy})),
		);
	});

	/* *******************************************************
        Digests
    ******************************************************** */

	/** Report individual conflicts and missing digests without labeling unreachable peers as agreeing. */
	private digest(member_id: number): string {
		const agreement = this.members()?.digest_agreement;
		if (!agreement?.compared_members.includes(member_id)) return 'Not compared';
		const kinds = agreement.conflicts
			.filter((conflict) => [conflict.first_member_id, conflict.second_member_id].includes(member_id))
			.map((conflict) => statusLabel(conflict.kind));
		if (kinds.length) return [...new Set(kinds)].join(', ');
		if (agreement.digest_alert_members.includes(member_id)) return 'Digest alert';
		if (agreement.missing_application_digest_members.includes(member_id)) return 'Application digest missing';
		return statusLabel(agreement.state);
	}
}
