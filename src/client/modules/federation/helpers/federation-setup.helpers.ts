/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {toConnectionError} from '@client/modules/error/helpers/error.helpers';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {paymentRule} from '@client/modules/federation/helpers/federation-status.helpers';
import {FEDERATION_SETUP_INVITATION_PREFIX} from '@client/modules/federation/constants/federation.constants';
import type {FederationSetupInvitationPreview, FederationSetupThresholds} from '@client/modules/federation/types/federation-setup.types';

/* Shared Dependencies */
import type {OrchardFederationPaymentVerificationPolicy} from '@shared/generated.types';

/** Split denominations without converting their uint64 values to JavaScript numbers. */
export function parseAmounts(text: string): string[] {
	return text
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean);
}

/** The first `count` powers of two as uint64 strings, 1 up to 2^63. */
export function powerAmounts(count: number): string[] {
	return Array.from({length: count}, (_, index) => (BigInt(1) << BigInt(index)).toString());
}

/** cdk's rules for a member count: signing from f + 1 (at least 2) to consensus, payment checks from consensus to every member. */
export function setupThresholds(members: number): FederationSetupThresholds {
	const faulty = Math.floor((members - 1) / 3);
	const consensus = members - faulty;
	// cdk accepts 1 at create, but its FROST key generation needs at least 2 signers and the ceremony stalls
	const sign_min = Math.max(2, faulty + 1);
	// cdk has no signing default; a simple majority keeps 3 of 5
	const sign_default = Math.min(consensus, Math.max(sign_min, Math.floor(members / 2) + 1));
	return {
		faulty,
		consensus,
		sign_min,
		sign_max: consensus,
		sign_default,
		payment_min: consensus,
		payment_max: members,
		payment_default: consensus,
	};
}

/** Read an invitation's slot, coordinator and expiry for display; the mint still verifies it on join. */
export function decodeSetupInvitation(text: string): FederationSetupInvitationPreview | null {
	const code = text.trim();
	if (!code.startsWith(FEDERATION_SETUP_INVITATION_PREFIX)) return null;
	try {
		const base64 = code.slice(FEDERATION_SETUP_INVITATION_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const view = new DataView(bytes.buffer);
		// Version (2 bytes), setup ID and invitation ID (32 each) come before the member slot
		const url_length = view.getUint32(68);
		const expiry_offset = 72 + url_length + 33;
		// Capability (32) and checksum (6) close the payload
		if (bytes.length !== expiry_offset + 8 + 32 + 6) return null;
		return {
			member_id: view.getUint16(66),
			coordinator_url: new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(72, 72 + url_length)),
			expires_at_unix: Number(view.getBigUint64(expiry_offset)),
		};
	} catch {
		return null;
	}
}

/** Only a daemon in setup mode lacks its API and database; an unreachable management RPC may leave both serving. */
export function isMintAvailable(mode: string | null | undefined): boolean {
	return mode !== 'setup';
}

/** Keep the Orchard error code with the mint's own diagnostic, so operators can report both. */
export function toOrchardError(error: unknown): OrchardError {
	return (error instanceof OrchardErrors && error.errors[0]) || toConnectionError(error);
}

/** "sat · 1 to 128 · no fee", ordering whole amounts without losing uint64 precision; the mint validates anything else. */
export function setupKeysetSummary(unit: string, amounts: string[], fee: string): string {
	const sorted = amounts.every((amount) => /^\d+$/.test(amount))
		? [...amounts].sort((left, right) => (BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0))
		: amounts;
	const range = sorted.length > 1 ? `${sorted[0]} to ${sorted.at(-1)}` : (sorted[0] ?? 'no denominations');
	const trimmed = fee.trim();
	return [unit.trim(), range, !trimmed || trimmed === '0' ? 'no fee' : `${trimmed} ppk fee`].join(' · ');
}

/** The host of a member URL for a compact title, or the value itself when it isn't a URL. */
export function setupUrlHost(url: string): string {
	try {
		return new URL(url).host || url;
	} catch {
		return url;
	}
}

/** "members 1 and 5" or "members 1, 2 and 5". */
export function setupMemberList(members: number[]): string {
	if (!members.length) return 'none yet';
	if (members.length === 1) return `member ${members[0]}`;
	return `members ${members.slice(0, -1).join(', ')} and ${members.at(-1)}`;
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
