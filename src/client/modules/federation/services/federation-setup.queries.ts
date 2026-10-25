const KEYSET_FIELDS = 'unit amounts input_fee_ppk final_expiry';
export const FEDERATION_SETUP_STATUS_QUERY = `query FederationSetupStatus {
    federation_setup_status {
        initialized setup_id member_id role participant_phase coordinator_phase member_count
        enrolled_members missing_enrollments approved_members proposal_hash identity_fingerprint
        dkg { phase participant_states commitments reveals secret_share_contributions keyset_shares
            transcript_signatures final_config_confirmations frost_root_public_configs confirmed_members finalized_ready
            dkg_confirmation_digest final_config_digest transcript_hash error }
        activation { federation_id }
    }
}`;
export const FEDERATION_SETUP_REVIEW_QUERY = `query FederationSetupReview {
    federation_setup_review {
        setup_id proposed_federation_id proposal_hash network member_count signature_threshold consensus_threshold details_json
        members { member_id public_mint_url federation_api_url identity_fingerprint }
        keysets { ${KEYSET_FIELDS} }
    }
}`;
export const FEDERATION_SETUP_CREATE_MUTATION = `mutation FederationSetupCreate($input: FederationSetupCreateInput!) {
    federation_setup_create(input: $input) { setup_id member_id invitations { member_id invitation expires_at_unix } }
}`;
export const FEDERATION_SETUP_JOIN_MUTATION = `mutation FederationSetupJoin($input: FederationSetupJoinInput!) {
    federation_setup_join(input: $input) { setup_id member_id }
}`;
export const FEDERATION_SETUP_PROPOSE_MUTATION = `mutation FederationSetupPropose {
    federation_setup_propose { proposal_hash }
}`;
export const FEDERATION_SETUP_APPROVE_MUTATION = `mutation FederationSetupApprove($proposal_hash: String!) {
    federation_setup_approve(proposal_hash: $proposal_hash) { proposal_hash }
}`;
export const FEDERATION_SETUP_ACTIVATE_MUTATION = `mutation FederationSetupActivate {
    federation_setup_activate { setup_id member_id federation_id final_config_digest backup_warning }
}`;

export const FEDERATION_SETUP_REPLACE_INVITATION_MUTATION = `mutation FederationSetupReplaceInvitation($member_id: Int!) {
    federation_setup_replace_invitation(member_id: $member_id) { invitation { member_id invitation expires_at_unix } }
}`;
export const FEDERATION_SETUP_ABORT_MUTATION = `mutation FederationSetupAbort($setup_id: String!) {
    federation_setup_abort(setup_id: $setup_id) { setup_id }
}`;
