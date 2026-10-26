/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {toConnectionError} from '@client/modules/error/helpers/error.helpers';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {paymentRule} from '@client/modules/federation/helpers/federation-status.helpers';

/* Shared Dependencies */
import type {OrchardFederationPaymentVerificationPolicy} from '@shared/generated.types';

/** Split denominations without converting their uint64 values to JavaScript numbers. */
export function parseAmounts(text: string): string[] {
	return text
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean);
}

/** Only a daemon in setup mode lacks its API and database; an unreachable management RPC may leave both serving. */
export function isMintAvailable(mode: string | null | undefined): boolean {
	return mode !== 'setup';
}

/** Keep the Orchard error code with the mint's own diagnostic, so operators can report both. */
export function toOrchardError(error: unknown): OrchardError {
	return (error instanceof OrchardErrors && error.errors[0]) || toConnectionError(error);
}

/** Group a hexadecimal identity fingerprint for comparison without changing unknown formats. */
export function displayFingerprint(fingerprint: string): string {
	return /^[0-9a-f]{16}$/i.test(fingerprint) ? fingerprint.match(/.{4}/g)!.join(' ') : fingerprint;
}

/** Map a known cdk JSON payment policy type onto the typed policy the dashboard labels. */
function setupPaymentPolicy(type: string, required: number | null): OrchardFederationPaymentVerificationPolicy | null {
	if (type === 'development_single_observation')
		return {kind: 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION', required_observations: 1};
	if (type === 'member_quorum' && required !== null)
		return {kind: 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM', required_observations: required};
	return null;
}

/** Word one proposal policy as the dashboard does, keeping unknown policy types readable. */
function setupPaymentPolicyLabel(value: unknown): string {
	if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return paymentRule(null);
	const required = 'required' in value && typeof value.required === 'number' ? value.required : null;
	const policy = setupPaymentPolicy(value.type, required);
	if (policy) return paymentRule(policy);
	return required === null ? value.type : paymentRule({kind: value.type, required_observations: required});
}

/** Read the proposal's payment rules without rewriting any other proposal values. */
export function setupPaymentRule(details_json: string): string {
	let details: unknown;
	try {
		details = JSON.parse(details_json);
	} catch {
		return paymentRule(null);
	}
	const policy =
		details && typeof details === 'object' && 'payment_observation_policy' in details ? details.payment_observation_policy : null;
	if (!policy || typeof policy !== 'object') return paymentRule(null);
	const incoming = setupPaymentPolicyLabel('mint_quotes' in policy ? policy.mint_quotes : null);
	const outgoing = setupPaymentPolicyLabel('melt_quotes' in policy ? policy.melt_quotes : null);
	return incoming === outgoing ? incoming : `Incoming: ${incoming} · Outgoing: ${outgoing}`;
}
