/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';

@ObjectType()
export class OrchardFederationThresholdParams {
	@Field(() => Int, {description: 'Number of federation members.'})
	member_count: number;

	@Field(() => Int, {description: 'Number of members whose signatures are needed to sign.'})
	signature_threshold: number;

	@Field(() => Int, {description: 'Number of members needed to reach consensus.'})
	consensus_threshold: number;
}

@ObjectType()
export class OrchardFederationMember {
	@Field(() => Int, {description: 'Member slot.'})
	member_id: number;

	@Field(() => String, {description: "Wallet-facing URL of the member's mint."})
	public_mint_url: string;

	@Field(() => String, {description: "URL other members use to reach the member's federation API."})
	federation_api_url: string;

	@Field(() => String, {description: "Public identity key that signs the member's federation traffic, as hex."})
	identity_public_key: string;
}

@ObjectType()
export class OrchardFederationKeyset {
	@Field(() => String, {description: 'Keyset ID.'})
	id: string;

	@Field(() => String, {description: 'Currency unit the keyset signs, e.g. "sat".'})
	unit: string;

	@Field(() => Boolean, {description: 'Whether members sign new outputs with this keyset.'})
	active: boolean;

	@Field(() => String, {description: 'Input fee charged per input, in parts per thousand.'})
	input_fee_ppk: string;

	@Field(() => String, {
		nullable: true,
		description: 'Absolute expiry as seconds since the UNIX epoch. Absent for a keyset that never expires.',
	})
	final_expiry?: string | null;
}

@ObjectType()
export class OrchardFederationPaymentVerificationPolicy {
	@Field(() => String, {
		nullable: true,
		description: 'Kind of policy. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	kind?: string | null;

	@Field(() => Int, {description: 'Number of matching member observations required.'})
	required_observations: number;
}

@ObjectType()
export class OrchardFederationPaymentObservationPolicy {
	@Field(() => OrchardFederationPaymentVerificationPolicy, {nullable: true, description: 'Policy for incoming payments to mint quotes.'})
	mint_quotes?: OrchardFederationPaymentVerificationPolicy | null;

	@Field(() => OrchardFederationPaymentVerificationPolicy, {
		nullable: true,
		description: 'Policy for outgoing payments from melt quotes.',
	})
	melt_quotes?: OrchardFederationPaymentVerificationPolicy | null;
}

@ObjectType()
export class OrchardFederationInfo {
	@Field(() => String, {description: 'Identifier of the federation.'})
	federation_id: string;

	@Field(() => Int, {description: 'Member slot of this daemon.'})
	local_member_id: number;

	@Field(() => String, {
		description:
			'Digest of the public federation config in effect, including keyset rotations accepted by consensus. Every member reports the same value.',
	})
	config_digest: string;

	@Field(() => Int, {description: 'Wallet-facing federation protocol version.'})
	wallet_protocol_version: number;

	@Field(() => OrchardFederationThresholdParams, {nullable: true, description: 'Member count and thresholds.'})
	threshold_params?: OrchardFederationThresholdParams | null;

	@Field(() => [OrchardFederationMember], {description: 'Members, ordered by member_id.'})
	members: OrchardFederationMember[];

	@Field(() => [OrchardFederationKeyset], {description: 'Keysets, in config order.'})
	keysets: OrchardFederationKeyset[];

	@Field(() => OrchardFederationPaymentObservationPolicy, {nullable: true, description: 'When payments count as observed.'})
	payment_observation_policy?: OrchardFederationPaymentObservationPolicy | null;
}

@ObjectType()
export class OrchardFederationSyncStatus {
	@Field(() => String, {
		nullable: true,
		description: 'Synchronization state. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	state?: string | null;

	@Field(() => Boolean, {description: 'Whether the member currently serves wallet requests.'})
	ready: boolean;

	@Field(() => String, {description: 'Detail for the operator, with secrets and paths removed.'})
	message: string;

	@Field(() => Int, {nullable: true, description: 'Member involved in the current state, when there is one.'})
	peer_member_id?: number | null;

	@Field(() => String, {nullable: true, description: "This member's operation count, while lagging."})
	local_operation_count?: string | null;

	@Field(() => String, {nullable: true, description: "The peer's operation count, while lagging."})
	peer_operation_count?: string | null;

	@Field(() => String, {nullable: true, description: 'Operation count being checked after catching up.'})
	operation_count?: string | null;
}

@ObjectType()
export class OrchardFederationPeerStatus {
	@Field(() => String, {description: "Number of operations accepted into the member's journal."})
	operation_count: string;

	@Field(() => String, {nullable: true, description: 'Index of the newest accepted operation, when there is one.'})
	latest_index?: string | null;

	@Field(() => String, {description: 'Current consensus session.'})
	aleph_bft_session: string;

	@Field(() => String, {nullable: true, description: 'Next finalized consensus item the member expects, when known.'})
	aleph_bft_next_item_index?: string | null;

	@Field(() => String, {description: 'Digest of the accepted operation order.'})
	latest_order_digest: string;

	@Field(() => String, {nullable: true, description: 'Digest of the applied operation results, when known.'})
	application_digest?: string | null;

	@Field(() => String, {nullable: true, description: 'Checkpoint whose state audit produced materialized_state_digest.'})
	latest_audited_checkpoint_id?: string | null;

	@Field(() => String, {nullable: true, description: 'Digest of the audited database state, when the member has audited one.'})
	materialized_state_digest?: string | null;
}

@ObjectType()
export class OrchardFederationQueueCounters {
	@Field(() => String, {description: 'Operations waiting to be proposed to consensus.'})
	pending_mempool_items: string;

	@Field(() => String, {description: 'Wallet requests waiting for an operation result.'})
	pending_response_waiters: string;

	@Field(() => String, {description: 'Cached operation responses.'})
	response_cache_items: string;

	@Field(() => String, {description: 'Response cache lookups since start.'})
	response_cache_lookups: string;

	@Field(() => String, {description: 'Response cache hits since start.'})
	response_cache_hits: string;

	@Field(() => String, {description: 'Response cache hit rate, in basis points.'})
	response_cache_hit_rate_bps: string;

	@Field(() => String, {description: 'Duplicate operation submissions since start.'})
	duplicate_submissions: string;

	@Field(() => String, {description: 'Duplicate submissions that joined a request already waiting.'})
	duplicate_pending_waiter_joins: string;
}

@ObjectType()
export class OrchardFederationConsensusRuntime {
	@Field(() => String, {description: 'Session the runtime is in.'})
	session: string;

	@Field(() => String, {description: 'Next finalized consensus item the runtime expects.'})
	next_item_index: string;

	@Field(() => String, {description: 'Local items waiting to be proposed.'})
	queued_item_count: string;

	@Field(() => String, {description: 'Proposed items waiting to be finalized.'})
	pending_finalization_item_count: string;

	@Field(() => String, {description: 'Finalized items, including the trusted base.'})
	finalized_item_count: string;

	@Field(() => String, {description: 'Accepted operations.'})
	accepted_operation_count: string;

	@Field(() => String, {nullable: true, description: 'Index of the newest accepted operation, when there is one.'})
	latest_accepted_operation_index?: string | null;
}

@ObjectType()
export class OrchardFederationConsensusStatus {
	@Field(() => Boolean, {description: 'Whether the live consensus session is running.'})
	live_session_active: boolean;

	@Field(() => Boolean, {description: 'Whether the member accepts consensus messages from other members.'})
	network_inbound_active: boolean;

	@Field(() => OrchardFederationConsensusRuntime, {nullable: true, description: 'Runtime counters, when the runtime is running.'})
	runtime?: OrchardFederationConsensusRuntime | null;
}

@ObjectType()
export class OrchardFederationActiveSessionBackup {
	@Field(() => String, {description: 'Session the backup covers.'})
	session: string;

	@Field(() => String, {description: 'Number of stored backup chunks.'})
	chunk_count: string;

	@Field(() => String, {description: 'Total stored backup bytes.'})
	total_bytes: string;
}

@ObjectType()
export class OrchardFederationCheckpointStatus {
	@Field(() => String, {description: 'First operation index not yet in the journal.'})
	journal_next_index: string;

	@Field(() => String, {description: 'First finalized consensus item index not yet recorded.'})
	finalized_next_item_index: string;

	@Field(() => String, {description: 'First operation index without an applied result.'})
	application_next_index: string;

	@Field(() => Boolean, {
		description:
			'Whether a state audit found a digest mismatch. Once set it stays set and the member stops serving until an operator intervenes.',
	})
	audit_mismatch: boolean;

	@Field(() => String, {nullable: true, description: 'Checkpoint the member trusts as its recovery base, when it has one.'})
	trusted_checkpoint_id?: string | null;

	@Field(() => [Int], {description: 'Members that signed the trusted checkpoint, ordered by member_id.'})
	trusted_checkpoint_signers: number[];

	@Field(() => String, {nullable: true, description: 'Number of operations the trusted checkpoint covers.'})
	trusted_checkpoint_operation_count?: string | null;

	@Field(() => String, {description: 'Operations accepted after the trusted checkpoint.'})
	lag_from_trusted_checkpoint: string;

	@Field(() => String, {nullable: true, description: 'Newest scheduled checkpoint captured locally.'})
	latest_scheduled_checkpoint_id?: string | null;

	@Field(() => String, {nullable: true, description: 'Newest scheduled checkpoint with a stored signature quorum.'})
	latest_scheduled_quorum_id?: string | null;

	@Field(() => String, {nullable: true, description: 'Newest recovery checkpoint with a stored signature quorum.'})
	latest_recovery_quorum_id?: string | null;

	@Field(() => OrchardFederationActiveSessionBackup, {
		nullable: true,
		description: 'Backup of the active consensus session, when one exists.',
	})
	active_session_backup?: OrchardFederationActiveSessionBackup | null;
}

@ObjectType()
export class OrchardFederationPaymentObservationGroup {
	@Field(() => String, {description: 'Observed quote state, e.g. "PAID".'})
	state: string;

	@Field(() => [Int], {description: 'Members whose observations match, ordered by member_id.'})
	observers: number[];

	@Field(() => Boolean, {description: 'Whether enough members observed this evidence.'})
	quorum_reached: boolean;

	@Field(() => Boolean, {description: 'Whether the observed state is final for the quote.'})
	terminal_state: boolean;

	@Field(() => [Int], {description: 'Members that reported different evidence for the same state.'})
	conflicting_observers: number[];

	@Field(() => [String], {description: 'Consensus indexes of the operations that carried these observations.'})
	operation_indices: string[];
}

@ObjectType()
export class OrchardFederationPaymentObservationReport {
	@Field(() => String, {
		nullable: true,
		description: 'Mint or melt quote. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	context?: string | null;

	@Field(() => String, {description: 'Quote ID.'})
	quote: string;

	@Field(() => String, {
		nullable: true,
		description: 'Overall state of the observations. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	status?: string | null;

	@Field(() => String, {
		nullable: true,
		description: 'What the operator should do. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	recommended_action?: string | null;

	@Field(() => Int, {description: 'Number of matching observations required.'})
	required: number;

	@Field(() => String, {description: 'Number of observations counted.'})
	total_observations: string;

	@Field(() => String, {
		nullable: true,
		description:
			'Age of the quote in seconds. Absent when unknown. A member reading its own status skips the lookup for reports no longer waiting for observations, so those have no age in GetLocalStatus.',
	})
	quote_age_secs?: string | null;

	@Field(() => Boolean, {description: 'Whether the report has waited too long without reaching quorum.'})
	stale: boolean;

	@Field(() => [Int], {description: 'Members whose observations conflict with another group.'})
	conflicting_observers: number[];

	@Field(() => [Int], {description: 'Members that reported competing final states.'})
	competing_terminal_state_observers: number[];

	@Field(() => [OrchardFederationPaymentObservationGroup], {description: 'Groups of matching observations.'})
	groups: OrchardFederationPaymentObservationGroup[];
}

@ObjectType()
export class OrchardFederationPaymentObservationSummary {
	@Field(() => String, {description: 'All reports, including resolved ones.'})
	total_reports: string;

	@Field(() => String, {description: 'Reports with no observations.'})
	empty: string;

	@Field(() => String, {description: 'Reports still waiting for matching observations.'})
	awaiting_quorum: string;

	@Field(() => String, {description: 'Reports where enough members agree.'})
	quorum_reached: string;

	@Field(() => String, {description: 'Reports with contradicting observations.'})
	conflicting: string;

	@Field(() => String, {description: 'Reports that waited too long without reaching quorum.'})
	stale: string;

	@Field(() => String, {description: 'Reports that recommend an operator look at them.'})
	inspect: string;

	@Field(() => [OrchardFederationPaymentObservationReport], {
		description: 'Reports that are unresolved, conflicting, stale, or recommend inspection, newest first, up to the requested limit.',
	})
	reports: OrchardFederationPaymentObservationReport[];

	@Field(() => Boolean, {description: 'Whether more reports needed attention than are listed.'})
	truncated: boolean;
}

@ObjectType()
export class OrchardFederationInvalidOperationAlert {
	@Field(() => String, {description: 'Source category, e.g. "auth_token" or "client_ip".'})
	source: string;

	@Field(() => String, {description: 'Number of sources currently above the alert threshold.'})
	alerting_buckets: string;

	@Field(() => String, {description: 'Highest invalid-operation count among alerting sources.'})
	max_count: string;

	@Field(() => String, {description: 'Count at which one source alerts.'})
	threshold: string;

	@Field(() => String, {description: 'Counting window, in seconds.'})
	window_secs: string;
}

@ObjectType()
export class OrchardFederationMemberStatus {
	@Field(() => Int, {description: 'Member slot.'})
	member_id: number;

	@Field(() => String, {description: 'Federation the member serves.'})
	federation_id: string;

	@Field(() => OrchardFederationSyncStatus, {nullable: true, description: 'Synchronization state.'})
	sync?: OrchardFederationSyncStatus | null;

	@Field(() => OrchardFederationPeerStatus, {nullable: true, description: 'Consensus position.'})
	peer?: OrchardFederationPeerStatus | null;

	@Field(() => OrchardFederationQueueCounters, {nullable: true, description: 'Queue and cache counters.'})
	queues?: OrchardFederationQueueCounters | null;

	@Field(() => OrchardFederationConsensusStatus, {nullable: true, description: 'Consensus health.'})
	consensus?: OrchardFederationConsensusStatus | null;

	@Field(() => OrchardFederationCheckpointStatus, {nullable: true, description: 'Checkpoint summary.'})
	checkpoint?: OrchardFederationCheckpointStatus | null;

	@Field(() => OrchardFederationPaymentObservationSummary, {nullable: true, description: 'Payment observation reports.'})
	payment_observations?: OrchardFederationPaymentObservationSummary | null;

	@Field(() => [OrchardFederationInvalidOperationAlert], {description: 'Invalid-operation alerts.'})
	invalid_operation_alerts: OrchardFederationInvalidOperationAlert[];
}

@ObjectType()
export class OrchardFederationLocalStatus {
	@Field(() => OrchardFederationMemberStatus, {nullable: true, description: 'Status of this member.'})
	status?: OrchardFederationMemberStatus | null;
}

@ObjectType()
export class OrchardFederationMemberStatusResult {
	@Field(() => Int, {description: 'Member slot.'})
	member_id: number;

	@Field(() => Boolean, {
		description: 'Whether this is the member serving the request. Its status is read locally rather than over the network.',
	})
	local: boolean;

	@Field(() => Boolean, {description: 'Whether the member answered with a valid status.'})
	reachable: boolean;

	@Field(() => String, {description: 'Time the request took, in milliseconds.'})
	latency_ms: string;

	@Field(() => String, {nullable: true, description: 'Why the member could not be read, when it could not.'})
	error?: string | null;

	@Field(() => OrchardFederationMemberStatus, {nullable: true, description: 'Status of the member, when it answered.'})
	status?: OrchardFederationMemberStatus | null;
}

@ObjectType()
export class OrchardFederationDigestConflict {
	@Field(() => String, {
		nullable: true,
		description: 'What differs. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	kind?: string | null;

	@Field(() => Int, {description: 'First member.'})
	first_member_id: number;

	@Field(() => Int, {description: 'Second member.'})
	second_member_id: number;

	@Field(() => String, {description: 'Operation count both members report.'})
	operation_count: string;
}

@ObjectType()
export class OrchardFederationDigestGroup {
	@Field(() => String, {description: 'Operation count.'})
	operation_count: string;

	@Field(() => String, {description: 'Consensus session.'})
	aleph_bft_session: string;

	@Field(() => String, {description: 'Digest of the accepted operation order.'})
	order_digest: string;

	@Field(() => String, {nullable: true, description: 'Digest of the applied operation results, when reported.'})
	application_digest?: string | null;

	@Field(() => [Int], {description: 'Members in the group, ordered by member_id.'})
	members: number[];

	@Field(() => Int, {description: 'Members in the group that serve wallet requests.'})
	ready_count: number;
}

@ObjectType()
export class OrchardFederationDigestAgreement {
	@Field(() => String, {
		nullable: true,
		description: 'Overall result. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	state?: string | null;

	@Field(() => [Int], {description: 'Members compared, ordered by member_id. Unreachable members are left out.'})
	compared_members: number[];

	@Field(() => [OrchardFederationDigestGroup], {description: 'Members grouped by consensus position, lowest operation count first.'})
	groups: OrchardFederationDigestGroup[];

	@Field(() => [Int], {description: 'Members whose state audit found a digest mismatch.'})
	digest_alert_members: number[];

	@Field(() => [Int], {description: 'Members that did not report an application digest.'})
	missing_application_digest_members: number[];

	@Field(() => [OrchardFederationDigestConflict], {description: 'Pairs of members that contradict each other.'})
	conflicts: OrchardFederationDigestConflict[];
}

@ObjectType()
export class OrchardFederationMemberStatuses {
	@Field(() => [OrchardFederationMemberStatusResult], {description: 'One result per requested member, ordered by member_id.'})
	members: OrchardFederationMemberStatusResult[];

	@Field(() => OrchardFederationDigestAgreement, {nullable: true, description: 'Digest comparison of the members that answered.'})
	digest_agreement?: OrchardFederationDigestAgreement | null;

	@Field(() => String, {description: 'When the members were asked, in seconds since the UNIX epoch.'})
	queried_at_unix: string;
}

@ObjectType()
export class OrchardFederationOnchainWalletSource {
	@Field(() => String, {description: 'Source implementation, e.g. "esplora".'})
	source: string;

	@Field(() => String, {description: '"independent" or "shared", as declared by the operator.'})
	source_scope: string;

	@Field(() => String, {description: 'Opaque source identity. Never an endpoint or credential.'})
	source_id: string;

	@Field(() => Boolean, {description: 'Whether other members use the same source on purpose.'})
	correlated_source_warning: boolean;

	@Field(() => String, {
		nullable: true,
		description: 'Sync health. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	health?: string | null;

	@Field(() => Int, {description: 'Height of the newest locally stored block.'})
	local_tip_height: number;

	@Field(() => String, {description: 'Hash of the newest locally stored block.'})
	local_tip_hash: string;

	@Field(() => String, {nullable: true, description: 'Time of the last successful sync, in seconds since the UNIX epoch.'})
	last_success_unix?: string | null;

	@Field(() => Int, {description: 'Failed syncs since the last success.'})
	consecutive_failures: number;
}

@ObjectType()
export class OrchardFederationWalletUtxoCount {
	@Field(() => String, {
		nullable: true,
		description: 'UTXO state. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	state?: string | null;

	@Field(() => String, {description: 'Number of UTXOs.'})
	count: string;

	@Field(() => String, {description: 'Total value in satoshis.'})
	value_sat: string;
}

@ObjectType()
export class OrchardFederationWalletOperationPhaseCount {
	@Field(() => String, {
		nullable: true,
		description: 'Phase. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	phase?: string | null;

	@Field(() => String, {description: 'Number of records.'})
	count: string;
}

@ObjectType()
export class OrchardFederationWalletOperatorStatus {
	@Field(() => String, {description: 'Root key epoch serving the wallet.'})
	root_key_epoch: string;

	@Field(() => String, {description: 'Wallet application key epoch.'})
	application_key_epoch: string;

	@Field(() => String, {description: 'Commitment to the wallet descriptors, as hex.'})
	descriptor_commitment: string;

	@Field(() => String, {description: 'Bitcoin network.'})
	network: string;

	@Field(() => Int, {description: 'Confirmations required before funds count.'})
	minimum_confirmations: number;

	@Field(() => Int, {description: 'Fee policy version.'})
	fee_policy_version: number;

	@Field(() => String, {description: 'Receive addresses handed out.'})
	external_revealed_count: string;

	@Field(() => String, {description: 'Change addresses used.'})
	internal_revealed_count: string;

	@Field(() => [OrchardFederationWalletUtxoCount], {description: 'UTXOs by state.'})
	utxos: OrchardFederationWalletUtxoCount[];

	@Field(() => String, {description: 'Value locked by accepted transactions, in satoshis.'})
	reserved_value_sat: string;

	@Field(() => [OrchardFederationWalletOperationPhaseCount], {description: 'Records by phase.'})
	operation_phases: OrchardFederationWalletOperationPhaseCount[];

	@Field(() => String, {description: 'Withdrawal batches waiting, as seen by this member.'})
	pending_batches: string;

	@Field(() => String, {description: 'Signing attempts made by this member.'})
	signing_attempts: string;

	@Field(() => String, {description: 'Signing failures seen by this member.'})
	signing_failures: string;

	@Field(() => String, {
		nullable: true,
		description: 'Broadcast health. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	broadcast_health?: string | null;

	@Field(() => String, {description: 'Failed broadcast observations.'})
	broadcast_failures: string;
}

@ObjectType()
export class OrchardFederationWalletRecoveryActionCount {
	@Field(() => String, {
		nullable: true,
		description: 'Wallet area. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	phase?: string | null;

	@Field(() => String, {description: 'Stored state name.'})
	state: string;

	@Field(() => String, {
		nullable: true,
		description:
			'What recovery does with these records. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	action?: string | null;

	@Field(() => String, {description: 'Number of records.'})
	count: string;
}

@ObjectType()
export class OrchardFederationWalletRecoveryStatus {
	@Field(() => String, {description: 'Addresses handed out.'})
	address_allocations: string;

	@Field(() => String, {description: 'Wallet UTXOs.'})
	wallet_utxos: string;

	@Field(() => String, {description: 'Outgoing payment intents.'})
	payment_intents: string;

	@Field(() => String, {description: 'Accepted transactions.'})
	transactions: string;

	@Field(() => String, {description: 'Input reservations that recovery never releases.'})
	sticky_reservations: string;

	@Field(() => [OrchardFederationWalletRecoveryActionCount], {description: 'Records grouped by recovery action.'})
	actions: OrchardFederationWalletRecoveryActionCount[];
}

@ObjectType()
export class OrchardFederationWalletLivenessStatus {
	@Field(() => String, {description: 'Withdrawal batches waiting in the last round.'})
	pending_batches: string;

	@Field(() => String, {description: 'Transactions waiting for signatures in the last round.'})
	awaiting_signatures: string;

	@Field(() => String, {description: 'Proposal submissions attempted.'})
	proposal_attempts: string;

	@Field(() => String, {description: 'Signing runs attempted.'})
	signing_attempts: string;

	@Field(() => String, {description: 'Signer or transport failures.'})
	signer_failures: string;

	@Field(() => String, {
		nullable: true,
		description: 'Current activity. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	activity?: string | null;
}

@ObjectType()
export class OrchardFederationBarkVtxoCount {
	@Field(() => String, {description: 'VTXO state name.'})
	state: string;

	@Field(() => String, {description: 'Number of VTXOs.'})
	count: string;

	@Field(() => String, {description: 'Total value in satoshis.'})
	value_sat: string;
}

@ObjectType()
export class OrchardFederationBarkOperatorStatus {
	@Field(() => String, {
		nullable: true,
		description: 'Readiness. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	readiness?: string | null;

	@Field(() => String, {nullable: true, description: 'Why Bark is degraded, when it is.'})
	degraded_reason?: string | null;

	@Field(() => String, {description: 'Newest consensus operation Bark has accepted.'})
	accepted_frontier: string;

	@Field(() => String, {description: 'Newest operation applied to the local Bark state.'})
	local_frontier: string;

	@Field(() => String, {description: 'Operations the local Bark state is behind.'})
	projection_lag_operations: string;

	@Field(() => String, {description: 'Bitcoin network.'})
	network: string;

	@Field(() => Int, {nullable: true, description: 'Chain tip height, when known.'})
	chain_tip_height?: number | null;

	@Field(() => [OrchardFederationBarkVtxoCount], {description: 'VTXOs by state.'})
	vtxos: OrchardFederationBarkVtxoCount[];

	@Field(() => String, {nullable: true, description: 'VTXOs close to expiry, when known.'})
	expiring_vtxo_count?: string | null;

	@Field(() => String, {nullable: true, description: 'Value close to expiry in satoshis, when known.'})
	expiring_value_sat?: string | null;

	@Field(() => String, {description: 'Actions whose outcome is unclear.'})
	ambiguous_action_count: string;

	@Field(() => String, {description: 'Value of actions whose outcome is unclear, in satoshis.'})
	ambiguous_value_sat: string;

	@Field(() => String, {description: 'Actions that need recovery.'})
	recovery_required_action_count: string;

	@Field(() => String, {description: 'Value of actions that need recovery, in satoshis.'})
	recovery_required_value_sat: string;

	@Field(() => String, {description: 'Actions waiting to retry signing.'})
	signer_retry_action_count: string;

	@Field(() => String, {description: 'Locally acknowledged receive secrets that are missing.'})
	missing_acknowledged_receive_secrets: string;

	@Field(() => String, {description: 'The complete Bark status as JSON, including the fields not typed above. It holds no secrets.'})
	details_json: string;
}

@ObjectType()
export class OrchardFederationCustodyStatus {
	@Field(() => [OrchardFederationOnchainWalletSource], {description: 'On-chain data sources, when the member runs an on-chain wallet.'})
	onchain_wallets: OrchardFederationOnchainWalletSource[];

	@Field(() => OrchardFederationWalletOperatorStatus, {
		nullable: true,
		description: 'On-chain wallet state, when the federation has an on-chain wallet.',
	})
	wallet_operator?: OrchardFederationWalletOperatorStatus | null;

	@Field(() => OrchardFederationWalletRecoveryStatus, {
		nullable: true,
		description: 'On-chain wallet recovery plan, when the federation has an on-chain wallet.',
	})
	wallet_recovery?: OrchardFederationWalletRecoveryStatus | null;

	@Field(() => OrchardFederationWalletLivenessStatus, {
		nullable: true,
		description: 'On-chain wallet proposer and signer activity, when the federation has an on-chain wallet.',
	})
	wallet_liveness?: OrchardFederationWalletLivenessStatus | null;

	@Field(() => OrchardFederationBarkOperatorStatus, {
		nullable: true,
		description: 'Bark custody status, when the daemon runs Bark custody.',
	})
	bark?: OrchardFederationBarkOperatorStatus | null;
}
