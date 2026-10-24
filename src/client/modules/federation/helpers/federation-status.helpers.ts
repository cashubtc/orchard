/* Native Dependencies */
import {FEDERATION_STATUS_LABELS} from '@client/modules/federation/constants/federation.constants';

/* Shared Dependencies */
import type {
	OrchardFederationInfo,
	OrchardFederationCustodyStatus,
	OrchardFederationMemberStatus,
	OrchardFederationPaymentVerificationPolicy,
} from '@shared/generated.types';

/** Translate only recognized values, leaving future enum and phase strings untouched. */
export function statusLabel(value: string | null | undefined): string {
	if (value == null) return 'Not reported';
	return FEDERATION_STATUS_LABELS[value] ?? value;
}

/** A checkpoint audit mismatch halts the mint, whatever its sync state says. */
export function syncLabel(status: OrchardFederationMemberStatus | null | undefined): string {
	return status?.checkpoint?.audit_mismatch ? 'Halted' : statusLabel(status?.sync?.state);
}

/** Whether the mint serves wallets; a halted mint never does. */
export function readinessLabel(status: OrchardFederationMemberStatus | null | undefined): string {
	if (status?.checkpoint?.audit_mismatch || status?.sync?.ready === false) return 'Not serving wallets';
	return status?.sync?.ready ? 'Serving wallets' : 'Readiness not reported';
}

/** Any federated BDK section counts as on-chain custody. */
export function hasOnchainCustody(custody: OrchardFederationCustodyStatus | null | undefined): boolean {
	return !!(custody?.wallet_operator || custody?.wallet_recovery || custody?.wallet_liveness || custody?.onchain_wallets.length);
}

/** Development policy is explicit and independent of which custody backends are present. */
export function isDevelopment(info: OrchardFederationInfo | null): boolean {
	return [info?.payment_observation_policy?.mint_quotes, info?.payment_observation_policy?.melt_quotes].some(
		(policy) => policy?.kind === 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION',
	);
}

/** Describe the reported payment rule without assuming incoming and outgoing thresholds match. */
export function paymentRule(policy: OrchardFederationPaymentVerificationPolicy | null | undefined): string {
	if (!policy) return 'Payment rule not reported';
	if (policy.kind === 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION')
		return '1 member’s report is enough · development policy';
	if (policy.kind === 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM')
		return `${policy.required_observations} members must report matching observations`;
	return `${policy.kind} · ${policy.required_observations} observations`;
}

/** Backend attribution comes from reported custody; mint info does not name its payment processor. */
export function paymentBackend(method: string, custody: OrchardFederationCustodyStatus | null): string {
	if (!custody) return 'Backend not reported';
	if (method === 'bolt11' && custody.bark) return 'Federated Bark, through Ark';
	if (method === 'onchain' && (custody.wallet_operator || custody.onchain_wallets.length)) return 'Federated BDK';
	if (!custody.bark && !hasOnchainCustody(custody)) return 'No custody reported · fake wallet or another test backend';
	return 'Backend not reported';
}

/** Convert only valid timestamp-sized integers for the existing localTime pipe; counters remain strings. */
export function timestamp(value: string | null | undefined): number | null {
	if (!value || !/^\d+$/.test(value)) return null;
	const seconds = Number(value);
	return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 8640000000000 ? seconds : null;
}
