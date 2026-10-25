/** What the setup confirmation dialog asks the operator to confirm. */
export type FederationSetupConfirm = {action: 'abort'} | {action: 'replace'; member_id: number};
