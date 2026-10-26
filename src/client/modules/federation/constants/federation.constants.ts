/* Shared Dependencies */
import type {OrchardFederationSetupDkg} from '@shared/generated.types';

/** The five stages of federation setup, shown as progress and on the start page. */
export const FEDERATION_SETUP_STEPS = [
	{title: 'Create or join', detail: 'The coordinator creates the setup and sends each operator an invitation.'},
	{title: 'Enroll', detail: 'Every operator joins from their own mint.'},
	{title: 'Review', detail: 'Everyone checks the proposal and each member’s fingerprint, then approves.'},
	{title: 'Generate keys', detail: 'Mints create the federation keys together. No one holds the whole key.'},
	{title: 'Activate', detail: 'Each operator activates and backs up. The mint starts serving wallets.'},
];

/** What the operator confirms after activation; Orchard can't back up the mint itself. */
export const FEDERATION_BACKUP_ITEMS = [
	'Setup state: the federation-setup folder in the mint’s work directory',
	'The mint database',
	'The activated private federation config',
	'I’ve made an encrypted backup and checked that it restores',
];

/** Key-generation counters reported by GetSetupStatus. */
export const FEDERATION_DKG_STAGES: Array<{field: keyof OrchardFederationSetupDkg; label: string}> = [
	{field: 'participant_states', label: 'Member states shared'},
	{field: 'commitments', label: 'Commitments'},
	{field: 'reveals', label: 'Reveals'},
	{field: 'secret_share_contributions', label: 'Secret share contributions'},
	{field: 'keyset_shares', label: 'Keyset shares'},
	{field: 'frost_root_public_configs', label: 'FROST root public configs'},
	{field: 'transcript_signatures', label: 'Transcript signatures'},
	{field: 'final_config_confirmations', label: 'Final config confirmations'},
];

/** Bitcoin networks CreateSetup accepts. */
export const FEDERATION_NETWORKS = ['bitcoin', 'signet', 'testnet', 'regtest'];

/** Dashboard poll cadence, just past the window in which cdk reuses member statuses. */
export const FEDERATION_STATUS_INTERVAL_MS = 6000;

/** Shortest gap between member status reads; cdk reuses its snapshot for about this long. */
export const FEDERATION_MEMBERS_MIN_INTERVAL_MS = 5000;

/** Member dashboard sections, selected with the `view` query parameter. */
export const FEDERATION_DASHBOARD_TABS = [
	{view: 'overview', label: 'Overview'},
	{view: 'consensus', label: 'Consensus'},
	{view: 'custody', label: 'Custody'},
] as const;

/** Readable names for cdk setup and status enums; anything else is shown verbatim. */
export const FEDERATION_STATUS_LABELS: Record<string, string> = {
	SETUP_ROLE_COORDINATOR: 'Coordinator',
	SETUP_ROLE_MEMBER: 'Member',
	SETUP_PARTICIPANT_PHASE_IDENTITY_CREATED: 'Identity created',
	SETUP_PARTICIPANT_PHASE_ENROLLED: 'Enrolled',
	SETUP_PARTICIPANT_PHASE_PROPOSAL_REVIEWED: 'Proposal reviewed',
	SETUP_PARTICIPANT_PHASE_APPROVED: 'Approved',
	SETUP_PARTICIPANT_PHASE_CERTIFIED: 'All approvals certified',
	SETUP_PARTICIPANT_PHASE_DKG_RUNNING: 'Generating keys',
	SETUP_PARTICIPANT_PHASE_READY_TO_ACTIVATE: 'Ready to activate',
	SETUP_PARTICIPANT_PHASE_ACTIVATED: 'Activated',
	SETUP_PARTICIPANT_PHASE_ABORTED: 'Aborted',
	SETUP_COORDINATOR_PHASE_COLLECTING_ENROLLMENTS: 'Collecting enrollments',
	SETUP_COORDINATOR_PHASE_PROPOSAL_PUBLISHED: 'Proposal published',
	SETUP_COORDINATOR_PHASE_CERTIFIED: 'All approvals certified',
	SETUP_COORDINATOR_PHASE_CLOSED: 'Closed',
	SETUP_COORDINATOR_PHASE_ABORTED: 'Aborted',
	SETUP_DKG_PHASE_NOT_STARTED: 'Not started',
	SETUP_DKG_PHASE_COMMITMENT: 'Exchanging commitments',
	SETUP_DKG_PHASE_REVEAL: 'Revealing public polynomials',
	SETUP_DKG_PHASE_SHARE_DELIVERY: 'Delivering secret shares',
	SETUP_DKG_PHASE_LOCAL_KEYSET_SHARE: 'Storing local keyset share',
	SETUP_DKG_PHASE_TRANSCRIPT_SIGNATURE: 'Signing transcript',
	SETUP_DKG_PHASE_ACTIVATION: 'Confirming final configuration',
	SETUP_DKG_PHASE_FROST_ROUND_1: 'FROST round one',
	SETUP_DKG_PHASE_FROST_ROUND_2: 'FROST round two',
	SETUP_DKG_PHASE_FROST_CONFIRMATION: 'Confirming FROST result',
	SETUP_DKG_PHASE_COMPLETE: 'Complete',
	SETUP_DKG_PHASE_INVALID: 'Inconsistent key generation records',
	SYNC_STATE_HEALTHY: 'Healthy',
	SYNC_STATE_AWAITING_QUORUM: 'Awaiting quorum',
	SYNC_STATE_LAGGING: 'Lagging',
	SYNC_STATE_CATCHING_UP: 'Catching up',
	SYNC_STATE_HALTED: 'Halted',
	ONCHAIN_SOURCE_HEALTH_NEVER_SYNCED: 'Never synced',
	ONCHAIN_SOURCE_HEALTH_HEALTHY: 'Healthy',
	ONCHAIN_SOURCE_HEALTH_DEGRADED: 'Degraded',
	BARK_READINESS_READY: 'Ready',
	BARK_READINESS_BEHIND_CONSENSUS: 'Behind consensus',
	BARK_READINESS_DEGRADED: 'Degraded',
	DIGEST_AGREEMENT_STATE_UNKNOWN: 'Unknown',
	DIGEST_AGREEMENT_STATE_CONVERGED: 'Converged',
	DIGEST_AGREEMENT_STATE_CONVERGING: 'Converging',
	DIGEST_AGREEMENT_STATE_DIVERGED: 'Diverged',
	DIGEST_CONFLICT_KIND_ORDER_DIGEST: 'Operation order',
	DIGEST_CONFLICT_KIND_CHECKPOINT_AUDIT: 'Checkpoint audit',
	DIGEST_CONFLICT_KIND_APPLICATION_DIGEST: 'Applied results',
	PAYMENT_OBSERVATION_CONTEXT_MINT_QUOTE: 'Incoming',
	PAYMENT_OBSERVATION_CONTEXT_MELT_QUOTE: 'Outgoing',
	PAYMENT_OBSERVATION_REPORT_STATUS_EMPTY: 'Empty',
	PAYMENT_OBSERVATION_REPORT_STATUS_AWAITING_QUORUM: 'Awaiting quorum',
	PAYMENT_OBSERVATION_REPORT_STATUS_QUORUM_REACHED: 'Quorum reached',
	PAYMENT_OBSERVATION_REPORT_STATUS_CONFLICTING: 'Conflicting',
	WALLET_OPERATION_PHASE_CHAIN_OBSERVATION: 'Chain observation',
	WALLET_OPERATION_PHASE_PROPOSAL: 'Proposal',
	WALLET_OPERATION_PHASE_SIGNING: 'Signing',
	WALLET_OPERATION_PHASE_BROADCAST_AUTHORIZATION: 'Broadcast authorization',
	WALLET_OPERATION_PHASE_BROADCAST: 'Broadcast',
	WALLET_OPERATION_PHASE_CONFIRMATION: 'Confirmation',
	WALLET_OPERATION_PHASE_TERMINAL: 'Terminal',
	WALLET_RECOVERY_PHASE_ADDRESS: 'Address',
	WALLET_RECOVERY_PHASE_OBSERVATION: 'Observation',
	WALLET_RECOVERY_PHASE_PROPOSAL: 'Proposal',
	WALLET_RECOVERY_PHASE_RESERVATION: 'Reservation',
	WALLET_RECOVERY_PHASE_SIGNING: 'Signing',
	WALLET_RECOVERY_PHASE_SIGNED: 'Signed',
	WALLET_RECOVERY_PHASE_BROADCAST: 'Broadcast',
	WALLET_RECOVERY_PHASE_CONFIRMATION: 'Confirmation',
	WALLET_RECOVERY_PHASE_REPLACEMENT: 'Replacement',
	WALLET_RECOVERY_PHASE_TERMINAL: 'Terminal',
	WALLET_RECOVERY_ACTION_RECONCILE_BDK_INDEXES: 'Reconcile BDK indexes',
	WALLET_RECOVERY_ACTION_COLLECT_CHAIN_EVIDENCE: 'Collect chain evidence',
	WALLET_RECOVERY_ACTION_AWAIT_PROPOSAL: 'Await proposal',
	WALLET_RECOVERY_ACTION_PRESERVE_STICKY_RESERVATION: 'Preserve sticky reservation',
	WALLET_RECOVERY_ACTION_START_FRESH_SIGNING_ATTEMPT: 'Start fresh signing attempt',
	WALLET_RECOVERY_ACTION_REAPPLY_PERSISTED_TRANSACTION: 'Reapply persisted transaction',
	WALLET_RECOVERY_ACTION_PERSIST_BROADCAST_INTENT: 'Persist broadcast intent',
	WALLET_RECOVERY_ACTION_REBROADCAST_PERSISTED_TRANSACTION: 'Rebroadcast persisted transaction',
	WALLET_RECOVERY_ACTION_COLLECT_CONFIRMATION_EVIDENCE: 'Collect confirmation evidence',
	WALLET_RECOVERY_ACTION_OPERATOR_REVIEW: 'Operator review',
	WALLET_RECOVERY_ACTION_NO_OP: 'No op',
	WALLET_UTXO_STATE_OBSERVED: 'Observed',
	WALLET_UTXO_STATE_CONFIRMED: 'Confirming',
	WALLET_UTXO_STATE_SPENDABLE: 'Spendable',
	WALLET_UTXO_STATE_RESERVED: 'Reserved',
	WALLET_UTXO_STATE_SPENT: 'Spent',
	WALLET_UTXO_STATE_REORGED: 'Reorged',
	WALLET_UTXO_STATE_QUARANTINED: 'Quarantined',
	WALLET_BROADCAST_HEALTH_IDLE: 'Idle',
	WALLET_BROADCAST_HEALTH_AWAITING_AUTHORIZATION: 'Awaiting authorization',
	WALLET_BROADCAST_HEALTH_BROADCASTING: 'Broadcasting',
	WALLET_BROADCAST_HEALTH_CONFIRMING: 'Confirming',
	WALLET_BROADCAST_HEALTH_DEGRADED: 'Degraded',
	WALLET_LIVENESS_ACTIVITY_IDLE: 'Idle',
	WALLET_LIVENESS_ACTIVITY_WAITING_FOR_LEASE: 'Waiting for lease',
	WALLET_LIVENESS_ACTIVITY_PROPOSING: 'Proposing',
	WALLET_LIVENESS_ACTIVITY_SIGNING: 'Signing',
	WALLET_LIVENESS_ACTIVITY_BACKOFF: 'Backoff',
};
