import type {OrchardFederationSetupStatus, OrchardFederationSetupReview} from '@shared/generated.types';
/** A proposal fixture with different identities so review must confirm each member. */
export function setupProposal(): OrchardFederationSetupReview {
	return {
		setup_id: 'setup',
		proposal_hash: 'hash',
		proposed_federation_id: 'federation',
		network: 'regtest',
		signature_threshold: 2,
		member_count: 3,
		consensus_threshold: 3,
		keysets: [{unit: 'sat', amounts: ['1', '9007199254740993'], input_fee_ppk: '0'}],
		details_json: '{}',
		members: [1, 2, 3].map((member_id) => ({
			member_id,
			public_mint_url: `https://mint${member_id}.example`,
			federation_api_url: `https://fed${member_id}.example`,
			identity_fingerprint: `fingerprint-${member_id}`,
		})),
	};
}
/** Fresh coordinator status, before any invitations have been redeemed. */
export function setupStatus(): OrchardFederationSetupStatus {
	return {
		initialized: true,
		setup_id: 'setup',
		role: 'SETUP_ROLE_COORDINATOR',
		member_id: 1,
		member_count: 3,
		participant_phase: 'SETUP_PARTICIPANT_PHASE_ENROLLED',
		coordinator_phase: 'SETUP_COORDINATOR_PHASE_COLLECTING_ENROLLMENTS',
		enrolled_members: [1],
		missing_enrollments: [2, 3],
		approved_members: [],
		missing_approvals: [1, 2, 3],
		identity_fingerprint: '0123456789abcdef',
	};
}
