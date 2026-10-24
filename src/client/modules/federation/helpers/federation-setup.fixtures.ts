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
		role: 'coordinator',
		member_id: 1,
		member_count: 3,
		participant_phase: 'enrolled',
		coordinator_phase: 'collecting_enrollments',
		enrolled_members: [1],
		missing_enrollments: [2, 3],
		approved_members: [],
		missing_approvals: [1, 2, 3],
		invitations_expires_at: 1792886400,
		invitations: [
			{member_id: 2, invitation: 'secret-2'},
			{member_id: 3, invitation: 'secret-3'},
		],
	};
}
