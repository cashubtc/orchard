/* Shared Dependencies */
import type {
	OrchardFederationInfo,
	OrchardFederationLocalStatus,
	OrchardFederationMemberStatuses,
	OrchardFederationWalletOperatorStatus,
	OrchardFederationBarkOperatorStatus,
} from '@shared/generated.types';

/** A fresh typed status fixture for isolated rendering tests. */
export function federationInfo(): OrchardFederationInfo {
	return {
		federation_id: 'federation',
		local_member_id: 1,
		config_digest: 'config',
		wallet_protocol_version: 0,
		threshold_params: {
			member_count: 3,
			signature_threshold: 2,
			consensus_threshold: 3,
		},
		members: [1, 2, 3].map((member_id) => ({
			member_id,
			public_mint_url: `https://mint${member_id}.example`,
			federation_api_url: `https://fed${member_id}.example`,
			identity_public_key: `public-key-${member_id}`,
		})),
		keysets: [],
		payment_observation_policy: {
			mint_quotes: {
				kind: 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM',
				required_observations: 3,
			},
			melt_quotes: {
				kind: 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM',
				required_observations: 3,
			},
		},
	};
}

/** A fresh typed status fixture for isolated rendering tests. */
export function localStatus(): OrchardFederationLocalStatus {
	return {
		status: {
			member_id: 1,
			federation_id: 'federation',
			sync: {
				state: 'SYNC_STATE_HEALTHY',
				ready: true,
				message: 'Serving wallets',
			},
			peer: {
				operation_count: '18446744073709551615',
				aleph_bft_session: '0',
				latest_order_digest: '',
			},
			queues: {
				pending_mempool_items: '0',
				pending_response_waiters: '0',
				response_cache_items: '0',
				response_cache_lookups: '0',
				response_cache_hits: '0',
				response_cache_hit_rate_bps: '0',
				duplicate_submissions: '0',
				duplicate_pending_waiter_joins: '0',
			},
			consensus: {
				live_session_active: false,
				network_inbound_active: false,
			},
			checkpoint: {
				journal_next_index: '0',
				finalized_next_item_index: '0',
				application_next_index: '0',
				audit_mismatch: false,
				trusted_checkpoint_signers: [],
				lag_from_trusted_checkpoint: '0',
			},
			payment_observations: {
				total_reports: '0',
				empty: '0',
				awaiting_quorum: '0',
				quorum_reached: '0',
				conflicting: '0',
				stale: '0',
				inspect: '0',
				reports: [],
				truncated: false,
			},
			invalid_operation_alerts: [],
		},
	};
}

/** A fresh typed status fixture for isolated rendering tests. */
export function memberStatuses(): OrchardFederationMemberStatuses {
	return {
		members: [1, 2, 3].map((member_id) => ({
			member_id,
			local: member_id === 1,
			reachable: true,
			latency_ms: '1',
			status: {...localStatus().status!, member_id},
		})),
		digest_agreement: {
			state: 'DIGEST_AGREEMENT_STATE_CONVERGED',
			compared_members: [1, 2, 3],
			groups: [],
			digest_alert_members: [],
			missing_application_digest_members: [],
			conflicts: [],
		},
		queried_at_unix: '0',
	};
}

/** A fresh typed status fixture for isolated rendering tests. */
export function bdkWallet(): OrchardFederationWalletOperatorStatus {
	return {
		root_key_epoch: '0',
		application_key_epoch: '0',
		descriptor_commitment: '',
		network: 'signet',
		minimum_confirmations: 0,
		fee_policy_version: 0,
		external_revealed_count: '0',
		internal_revealed_count: '0',
		utxos: [
			{
				state: 'WALLET_UTXO_STATE_SPENDABLE',
				count: '6',
				value_sat: '18446744073709551615',
			},
		],
		reserved_value_sat: '0',
		operation_phases: [],
		pending_batches: '0',
		signing_attempts: '0',
		signing_failures: '0',
		broadcast_health: 'WALLET_BROADCAST_HEALTH_IDLE',
		broadcast_failures: '0',
	};
}

/** A fresh typed status fixture for isolated rendering tests. */
export function barkWallet(): OrchardFederationBarkOperatorStatus {
	return {
		readiness: 'BARK_READINESS_READY',
		accepted_frontier: '0',
		local_frontier: '0',
		projection_lag_operations: '0',
		network: 'signet',
		vtxos: [
			{
				state: 'spendable',
				count: '18',
				value_sat: '3410000',
			},
		],
		ambiguous_action_count: '0',
		ambiguous_value_sat: '0',
		recovery_required_action_count: '0',
		recovery_required_value_sat: '0',
		signer_retry_action_count: '0',
		missing_acknowledged_receive_secrets: '0',
		details_json: '{"value":18446744073709551615}',
	};
}
