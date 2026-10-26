/** What the setup confirmation dialog asks the operator to confirm. */
export type FederationSetupConfirm = {action: 'abort'} | {action: 'replace'; member_id: number};

/** How far one key-generation stage has got on this mint. */
export type FederationSetupStageState = 'done' | 'active' | 'pending';

/** One key-generation stage row with the count this mint reports. */
export type FederationSetupStage = {label: string; count: string; state: FederationSetupStageState};

/** The thresholds cdk accepts for a member count, with the values a new setup starts at. */
export type FederationSetupThresholds = {
	faulty: number;
	consensus: number;
	sign_min: number;
	sign_max: number;
	sign_default: number;
	payment_min: number;
	payment_max: number;
	payment_default: number;
};

/** The public fields of an invitation, read for display before the mint verifies it on join. */
export type FederationSetupInvitationPreview = {member_id: number; coordinator_url: string; expires_at_unix: number};
