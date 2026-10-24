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
