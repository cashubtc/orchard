/** What the setup confirmation dialog asks the operator to confirm. */
export type FederationSetupConfirm = {action: 'abort'} | {action: 'replace'; member_id: number};

/** How far one key-generation stage has got on this mint. */
export type FederationSetupStageState = 'done' | 'active' | 'pending';

/** One key-generation stage row with the count this mint reports. */
export type FederationSetupStage = {label: string; count: string; state: FederationSetupStageState};
