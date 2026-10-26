/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';

/* Application Dependencies */
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import type {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {federationSettingsOverview} from '@client/modules/federation/helpers/federation-settings.helpers';
import {FederationStatusErrorComponent} from '@client/modules/federation/components/federation-status-error/federation-status-error.component';
import {FederationCountPipe} from '@client/modules/federation/pipes/federation-count/federation-count.pipe';
import {FederationDurationPipe} from '@client/modules/federation/pipes/federation-duration/federation-duration.pipe';
import {
	hasDevelopmentPolicy,
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
	imports: [
		RouterLink,
		MatButtonModule,
		OrcButtonModule,
		OrcDataModule,
		OrcLocalModule,
		OrcMintGeneralModule,
		FederationStatusErrorComponent,
		FederationCountPipe,
		FederationDurationPipe,
	],
	templateUrl: './federation-overview.component.html',
	styleUrls: ['../federation-dashboard/federation-panels.scss', './federation-overview.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationOverviewComponent {
	private readonly settings_service = inject(FederationSettingsService);

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

	public readonly public_api = input<boolean>(true);
	public readonly info_error = input<OrchardError | null>(null);
	public readonly members_error = input<OrchardError | null>(null);
	public readonly local_error = input<OrchardError | null>(null);
	public readonly custody_error = input<OrchardError | null>(null);

	public readonly settings_loading = this.settings_service.loading;
	public readonly settings_error = this.settings_service.error;
	public readonly settings_summary = computed(() => federationSettingsOverview(this.settings_service.comparison()));

	public readonly info_loaded = computed(() => !!this.info() || !!this.info_error());
	public readonly members_loaded = computed(() => !!this.members() || !!this.members_error());
	public readonly local_loaded = computed(() => !!this.local() || !!this.local_error());
	public readonly custody_loaded = computed(() => !!this.custody() || !!this.custody_error());
	public readonly network = computed(() => this.custody()?.wallet_operator?.network ?? this.custody()?.bark?.network ?? null);
	public readonly reachable = computed(() => this.members()?.members.filter((member) => member.reachable).length);
	public readonly member_health = computed(() => {
		if (!this.members_loaded()) return {tone: 'neutral', text: 'Loading…'};
		const reachable = this.reachable();
		const info = this.info();
		if (reachable == null || !info) return {tone: 'neutral', text: 'Reachability not reported'};
		const total = info.threshold_params?.member_count ?? info.members.length;
		const offline = Math.max(0, total - reachable);
		const threshold = info.threshold_params?.consensus_threshold;
		if (threshold != null && reachable < threshold) return {tone: 'inactive', text: `${offline} offline · below consensus threshold`};
		if (offline)
			return {tone: 'warning', text: `${offline === 1 ? 'One' : offline} offline${threshold != null ? ' · still running' : ''}`};
		return {tone: 'active', text: 'All online'};
	});
	public readonly digest_health = computed(() => {
		if (!this.members_loaded()) return {tone: 'neutral', text: 'Loading…'};
		const agreement = this.members()?.digest_agreement;
		if (!agreement) return {tone: 'neutral', text: 'Digest agreement not reported'};
		if (agreement.conflicts.length || agreement.digest_alert_members.length || agreement.state === 'DIGEST_AGREEMENT_STATE_DIVERGED')
			return {tone: 'inactive', text: 'Disagreement needs investigation'};
		if (agreement.missing_application_digest_members.length) return {tone: 'warning', text: 'Application digests missing'};
		if (agreement.state === 'DIGEST_AGREEMENT_STATE_CONVERGED') return {tone: 'active', text: 'Compared members agree'};
		return {tone: 'warning', text: 'Members have not converged'};
	});
	public readonly local_health = computed(() => {
		if (!this.local_loaded()) return {tone: 'neutral', text: 'Loading…'};
		const status = this.local()?.status;
		if (status?.checkpoint?.audit_mismatch || status?.sync?.state === 'SYNC_STATE_HALTED')
			return {tone: 'inactive', text: readinessLabel(status)};
		if (!status?.sync) return {tone: 'neutral', text: 'Readiness not reported'};
		return {tone: status.sync.ready && status.sync.state === 'SYNC_STATE_HEALTHY' ? 'active' : 'warning', text: readinessLabel(status)};
	});
	public readonly payment_health = computed(() => {
		if (!this.local_loaded()) return {tone: 'neutral', text: 'Loading…'};
		const inspect = this.local()?.status?.payment_observations?.inspect;
		if (inspect != null && /^\d+$/.test(inspect) && BigInt(inspect) > 0n) return {tone: 'warning', text: 'Reports to inspect'};
		if (hasDevelopmentPolicy(this.info())) return {tone: 'warning', text: 'Single report · development policy'};
		return inspect == null ? {tone: 'neutral', text: 'Payment checks not reported'} : {tone: 'active', text: 'No reports to inspect'};
	});
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
		if (!this.members_loaded()) return 'Loading…';
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
