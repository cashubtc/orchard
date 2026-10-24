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

/** Readable names for cdk's snake_case setup phases. */
export const FEDERATION_PHASE_LABELS: Record<string, string> = {
	identity_created: 'Identity created',
	enrolled: 'Enrolled',
	proposal_reviewed: 'Proposal reviewed',
	approved: 'Approved',
	certified: 'All approvals certified',
	dkg_running: 'Generating keys',
	ready_to_activate: 'Ready to activate',
	activated: 'Activated',
	collecting_enrollments: 'Collecting enrollments',
	proposal_published: 'Proposal published',
	closed: 'Closed',
	aborted: 'Aborted',
};

/** Dashboard poll cadence, just past the window in which cdk reuses member statuses. */
export const FEDERATION_STATUS_INTERVAL_MS = 6000;

/** Member dashboard sections, selected with the `view` query parameter. */
export const FEDERATION_DASHBOARD_TABS = [
	{view: 'overview', label: 'Overview'},
	{view: 'consensus', label: 'Consensus'},
	{view: 'custody', label: 'Custody'},
] as const;

/** Readable names for cdk status values; anything else is shown verbatim. */
export const FEDERATION_STATUS_LABELS: Record<string, string> = {
	healthy: 'Healthy',
	awaiting_quorum: 'Awaiting quorum',
	lagging: 'Lagging',
	catching_up: 'Catching up',
	halted: 'Halted',
	ready: 'Ready',
	behind_consensus: 'Behind consensus',
	degraded: 'Degraded',
	never_synced: 'Never synced',
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
