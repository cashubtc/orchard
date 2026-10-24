/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';

@ObjectType()
export class OrchardFederationThresholdParams {
	@Field(() => Int)
	member_count: number;

	@Field(() => Int)
	signature_threshold: number;

	@Field(() => Int)
	consensus_threshold: number;
}

@ObjectType()
export class OrchardFederationMember {
	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	public_mint_url: string;

	@Field(() => String)
	federation_api_url: string;

	@Field(() => String)
	identity_public_key: string;
}

@ObjectType()
export class OrchardFederationKeyset {
	@Field(() => String)
	id: string;

	@Field(() => String)
	unit: string;

	@Field(() => Boolean)
	active: boolean;

	@Field(() => String)
	input_fee_ppk: string;

	@Field(() => String, {nullable: true})
	final_expiry?: string | null;
}

@ObjectType()
export class OrchardFederationPaymentVerificationPolicy {
	@Field(() => String)
	kind: string;

	@Field(() => Int)
	required_observations: number;
}

@ObjectType()
export class OrchardFederationPaymentObservationPolicy {
	@Field(() => OrchardFederationPaymentVerificationPolicy, {nullable: true})
	mint_quotes?: OrchardFederationPaymentVerificationPolicy | null;

	@Field(() => OrchardFederationPaymentVerificationPolicy, {nullable: true})
	melt_quotes?: OrchardFederationPaymentVerificationPolicy | null;
}

@ObjectType()
export class OrchardFederationInfo {
	@Field(() => String)
	federation_id: string;

	@Field(() => Int)
	local_member_id: number;

	@Field(() => String)
	config_digest: string;

	@Field(() => Int)
	wallet_protocol_version: number;

	@Field(() => OrchardFederationThresholdParams, {nullable: true})
	threshold_params?: OrchardFederationThresholdParams | null;

	@Field(() => [OrchardFederationMember])
	members: OrchardFederationMember[];

	@Field(() => [OrchardFederationKeyset])
	keysets: OrchardFederationKeyset[];

	@Field(() => OrchardFederationPaymentObservationPolicy, {nullable: true})
	payment_observation_policy?: OrchardFederationPaymentObservationPolicy | null;
}

@ObjectType()
export class OrchardFederationSyncStatus {
	@Field(() => String)
	state: string;

	@Field(() => Boolean)
	ready: boolean;

	@Field(() => String)
	message: string;

	@Field(() => Int, {nullable: true})
	peer_member_id?: number | null;

	@Field(() => String, {nullable: true})
	local_operation_count?: string | null;

	@Field(() => String, {nullable: true})
	peer_operation_count?: string | null;

	@Field(() => String, {nullable: true})
	operation_count?: string | null;
}

@ObjectType()
export class OrchardFederationPeerStatus {
	@Field(() => String)
	operation_count: string;

	@Field(() => String, {nullable: true})
	latest_index?: string | null;

	@Field(() => String)
	aleph_bft_session: string;

	@Field(() => String, {nullable: true})
	aleph_bft_next_item_index?: string | null;

	@Field(() => String)
	latest_order_digest: string;

	@Field(() => String, {nullable: true})
	application_digest?: string | null;

	@Field(() => String, {nullable: true})
	latest_audited_checkpoint_id?: string | null;

	@Field(() => String, {nullable: true})
	materialized_state_digest?: string | null;
}

@ObjectType()
export class OrchardFederationQueueCounters {
	@Field(() => String)
	pending_mempool_items: string;

	@Field(() => String)
	pending_response_waiters: string;

	@Field(() => String)
	response_cache_items: string;

	@Field(() => String)
	response_cache_lookups: string;

	@Field(() => String)
	response_cache_hits: string;

	@Field(() => String)
	response_cache_hit_rate_bps: string;

	@Field(() => String)
	duplicate_submissions: string;

	@Field(() => String)
	duplicate_pending_waiter_joins: string;
}

@ObjectType()
export class OrchardFederationConsensusRuntime {
	@Field(() => String)
	session: string;

	@Field(() => String)
	next_item_index: string;

	@Field(() => String)
	queued_item_count: string;

	@Field(() => String)
	pending_finalization_item_count: string;

	@Field(() => String)
	finalized_item_count: string;

	@Field(() => String)
	accepted_operation_count: string;

	@Field(() => String, {nullable: true})
	latest_accepted_operation_index?: string | null;
}

@ObjectType()
export class OrchardFederationConsensusStatus {
	@Field(() => Boolean)
	live_session_active: boolean;

	@Field(() => Boolean)
	network_inbound_active: boolean;

	@Field(() => OrchardFederationConsensusRuntime, {nullable: true})
	runtime?: OrchardFederationConsensusRuntime | null;
}

@ObjectType()
export class OrchardFederationActiveSessionBackup {
	@Field(() => String)
	session: string;

	@Field(() => String)
	chunk_count: string;

	@Field(() => String)
	total_bytes: string;
}

@ObjectType()
export class OrchardFederationCheckpointStatus {
	@Field(() => String)
	journal_next_index: string;

	@Field(() => String)
	finalized_next_item_index: string;

	@Field(() => String)
	application_next_index: string;

	@Field(() => Boolean)
	audit_mismatch: boolean;

	@Field(() => String, {nullable: true})
	trusted_checkpoint_id?: string | null;

	@Field(() => [Int])
	trusted_checkpoint_signers: number[];

	@Field(() => String, {nullable: true})
	trusted_checkpoint_operation_count?: string | null;

	@Field(() => String)
	lag_from_trusted_checkpoint: string;

	@Field(() => String, {nullable: true})
	latest_scheduled_checkpoint_id?: string | null;

	@Field(() => String, {nullable: true})
	latest_scheduled_quorum_id?: string | null;

	@Field(() => String, {nullable: true})
	latest_recovery_quorum_id?: string | null;

	@Field(() => OrchardFederationActiveSessionBackup, {nullable: true})
	active_session_backup?: OrchardFederationActiveSessionBackup | null;
}

@ObjectType()
export class OrchardFederationPaymentObservationGroup {
	@Field(() => String)
	state: string;

	@Field(() => [Int])
	observers: number[];

	@Field(() => Boolean)
	quorum_reached: boolean;

	@Field(() => Boolean)
	terminal_state: boolean;

	@Field(() => [Int])
	conflicting_observers: number[];

	@Field(() => [String])
	operation_indices: string[];
}

@ObjectType()
export class OrchardFederationPaymentObservationReport {
	@Field(() => String)
	context: string;

	@Field(() => String)
	quote: string;

	@Field(() => String)
	status: string;

	@Field(() => String)
	recommended_action: string;

	@Field(() => Int)
	required: number;

	@Field(() => String)
	total_observations: string;

	@Field(() => String, {nullable: true})
	quote_age_secs?: string | null;

	@Field(() => Boolean)
	stale: boolean;

	@Field(() => [Int])
	conflicting_observers: number[];

	@Field(() => [Int])
	competing_terminal_state_observers: number[];

	@Field(() => [OrchardFederationPaymentObservationGroup])
	groups: OrchardFederationPaymentObservationGroup[];
}

@ObjectType()
export class OrchardFederationPaymentObservationSummary {
	@Field(() => String)
	total_reports: string;

	@Field(() => String)
	empty: string;

	@Field(() => String)
	awaiting_quorum: string;

	@Field(() => String)
	quorum_reached: string;

	@Field(() => String)
	conflicting: string;

	@Field(() => String)
	stale: string;

	@Field(() => String)
	inspect: string;

	@Field(() => [OrchardFederationPaymentObservationReport])
	reports: OrchardFederationPaymentObservationReport[];

	@Field(() => Boolean)
	truncated: boolean;
}

@ObjectType()
export class OrchardFederationInvalidOperationAlert {
	@Field(() => String)
	source: string;

	@Field(() => String)
	alerting_buckets: string;

	@Field(() => String)
	max_count: string;

	@Field(() => String)
	threshold: string;

	@Field(() => String)
	window_secs: string;
}

@ObjectType()
export class OrchardFederationMemberStatus {
	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	federation_id: string;

	@Field(() => OrchardFederationSyncStatus, {nullable: true})
	sync?: OrchardFederationSyncStatus | null;

	@Field(() => OrchardFederationPeerStatus, {nullable: true})
	peer?: OrchardFederationPeerStatus | null;

	@Field(() => OrchardFederationQueueCounters, {nullable: true})
	queues?: OrchardFederationQueueCounters | null;

	@Field(() => OrchardFederationConsensusStatus, {nullable: true})
	consensus?: OrchardFederationConsensusStatus | null;

	@Field(() => OrchardFederationCheckpointStatus, {nullable: true})
	checkpoint?: OrchardFederationCheckpointStatus | null;

	@Field(() => OrchardFederationPaymentObservationSummary, {nullable: true})
	payment_observations?: OrchardFederationPaymentObservationSummary | null;

	@Field(() => [OrchardFederationInvalidOperationAlert])
	invalid_operation_alerts: OrchardFederationInvalidOperationAlert[];
}

@ObjectType()
export class OrchardFederationLocalStatus {
	@Field(() => OrchardFederationMemberStatus, {nullable: true})
	status?: OrchardFederationMemberStatus | null;
}

@ObjectType()
export class OrchardFederationMemberStatusResult {
	@Field(() => Int)
	member_id: number;

	@Field(() => Boolean)
	local: boolean;

	@Field(() => Boolean)
	reachable: boolean;

	@Field(() => String)
	latency_ms: string;

	@Field(() => String, {nullable: true})
	error?: string | null;

	@Field(() => OrchardFederationMemberStatus, {nullable: true})
	status?: OrchardFederationMemberStatus | null;
}

@ObjectType()
export class OrchardFederationDigestConflict {
	@Field(() => String)
	kind: string;

	@Field(() => Int)
	first_member_id: number;

	@Field(() => Int)
	second_member_id: number;

	@Field(() => String)
	operation_count: string;
}

@ObjectType()
export class OrchardFederationDigestGroup {
	@Field(() => String)
	operation_count: string;

	@Field(() => String)
	aleph_bft_session: string;

	@Field(() => String)
	order_digest: string;

	@Field(() => String, {nullable: true})
	application_digest?: string | null;

	@Field(() => [Int])
	members: number[];

	@Field(() => Int)
	ready_count: number;
}

@ObjectType()
export class OrchardFederationDigestAgreement {
	@Field(() => String)
	state: string;

	@Field(() => [Int])
	compared_members: number[];

	@Field(() => [OrchardFederationDigestGroup])
	groups: OrchardFederationDigestGroup[];

	@Field(() => [Int])
	digest_alert_members: number[];

	@Field(() => [Int])
	missing_application_digest_members: number[];

	@Field(() => [OrchardFederationDigestConflict])
	conflicts: OrchardFederationDigestConflict[];
}

@ObjectType()
export class OrchardFederationMemberStatuses {
	@Field(() => [OrchardFederationMemberStatusResult])
	members: OrchardFederationMemberStatusResult[];

	@Field(() => OrchardFederationDigestAgreement, {nullable: true})
	digest_agreement?: OrchardFederationDigestAgreement | null;

	@Field(() => String)
	queried_at_unix: string;
}

@ObjectType()
export class OrchardFederationOnchainWalletSource {
	@Field(() => String)
	source: string;

	@Field(() => String)
	source_scope: string;

	@Field(() => String)
	source_id: string;

	@Field(() => Boolean)
	correlated_source_warning: boolean;

	@Field(() => String)
	health: string;

	@Field(() => Int)
	local_tip_height: number;

	@Field(() => String)
	local_tip_hash: string;

	@Field(() => String, {nullable: true})
	last_success_unix?: string | null;

	@Field(() => Int)
	consecutive_failures: number;
}

@ObjectType()
export class OrchardFederationWalletUtxoCount {
	@Field(() => String)
	state: string;

	@Field(() => String)
	count: string;

	@Field(() => String)
	value_sat: string;
}

@ObjectType()
export class OrchardFederationWalletOperationPhaseCount {
	@Field(() => String)
	phase: string;

	@Field(() => String)
	count: string;
}

@ObjectType()
export class OrchardFederationWalletOperatorStatus {
	@Field(() => String)
	root_key_epoch: string;

	@Field(() => String)
	application_key_epoch: string;

	@Field(() => String)
	descriptor_commitment: string;

	@Field(() => String)
	network: string;

	@Field(() => Int)
	minimum_confirmations: number;

	@Field(() => Int)
	fee_policy_version: number;

	@Field(() => String)
	external_revealed_count: string;

	@Field(() => String)
	internal_revealed_count: string;

	@Field(() => [OrchardFederationWalletUtxoCount])
	utxos: OrchardFederationWalletUtxoCount[];

	@Field(() => String)
	reserved_value_sat: string;

	@Field(() => [OrchardFederationWalletOperationPhaseCount])
	operation_phases: OrchardFederationWalletOperationPhaseCount[];

	@Field(() => String)
	pending_batches: string;

	@Field(() => String)
	signing_attempts: string;

	@Field(() => String)
	signing_failures: string;

	@Field(() => String)
	broadcast_health: string;

	@Field(() => String)
	broadcast_failures: string;
}

@ObjectType()
export class OrchardFederationWalletRecoveryActionCount {
	@Field(() => String)
	phase: string;

	@Field(() => String)
	state: string;

	@Field(() => String)
	action: string;

	@Field(() => String)
	count: string;
}

@ObjectType()
export class OrchardFederationWalletRecoveryStatus {
	@Field(() => String)
	address_allocations: string;

	@Field(() => String)
	wallet_utxos: string;

	@Field(() => String)
	payment_intents: string;

	@Field(() => String)
	transactions: string;

	@Field(() => String)
	sticky_reservations: string;

	@Field(() => [OrchardFederationWalletRecoveryActionCount])
	actions: OrchardFederationWalletRecoveryActionCount[];
}

@ObjectType()
export class OrchardFederationWalletLivenessStatus {
	@Field(() => String)
	pending_batches: string;

	@Field(() => String)
	awaiting_signatures: string;

	@Field(() => String)
	proposal_attempts: string;

	@Field(() => String)
	signing_attempts: string;

	@Field(() => String)
	signer_failures: string;

	@Field(() => String)
	activity: string;
}

@ObjectType()
export class OrchardFederationBarkVtxoCount {
	@Field(() => String)
	state: string;

	@Field(() => String)
	count: string;

	@Field(() => String)
	value_sat: string;
}

@ObjectType()
export class OrchardFederationBarkOperatorStatus {
	@Field(() => String)
	readiness: string;

	@Field(() => String, {nullable: true})
	degraded_reason?: string | null;

	@Field(() => String)
	accepted_frontier: string;

	@Field(() => String)
	local_frontier: string;

	@Field(() => String)
	projection_lag_operations: string;

	@Field(() => String)
	network: string;

	@Field(() => Int, {nullable: true})
	chain_tip_height?: number | null;

	@Field(() => [OrchardFederationBarkVtxoCount])
	vtxos: OrchardFederationBarkVtxoCount[];

	@Field(() => String, {nullable: true})
	expiring_vtxo_count?: string | null;

	@Field(() => String, {nullable: true})
	expiring_value_sat?: string | null;

	@Field(() => String)
	ambiguous_action_count: string;

	@Field(() => String)
	ambiguous_value_sat: string;

	@Field(() => String)
	recovery_required_action_count: string;

	@Field(() => String)
	recovery_required_value_sat: string;

	@Field(() => String)
	signer_retry_action_count: string;

	@Field(() => String)
	missing_acknowledged_receive_secrets: string;

	@Field(() => String)
	details_json: string;
}

@ObjectType()
export class OrchardFederationCustodyStatus {
	@Field(() => [OrchardFederationOnchainWalletSource])
	onchain_wallets: OrchardFederationOnchainWalletSource[];

	@Field(() => OrchardFederationWalletOperatorStatus, {nullable: true})
	wallet_operator?: OrchardFederationWalletOperatorStatus | null;

	@Field(() => OrchardFederationWalletRecoveryStatus, {nullable: true})
	wallet_recovery?: OrchardFederationWalletRecoveryStatus | null;

	@Field(() => OrchardFederationWalletLivenessStatus, {nullable: true})
	wallet_liveness?: OrchardFederationWalletLivenessStatus | null;

	@Field(() => OrchardFederationBarkOperatorStatus, {nullable: true})
	bark?: OrchardFederationBarkOperatorStatus | null;
}
