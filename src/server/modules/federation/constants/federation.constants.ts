/** Setup mutations may wait for another member over the federation network. */
export const SETUP_ACTION_TIMEOUT_MS = 120000;

/** Zero values for the federation fields that changed from strings to enums. */
export const FEDERATION_ABSENT_ENUMS = [
	'SETUP_ROLE_UNSPECIFIED',
	'SETUP_PARTICIPANT_PHASE_UNSPECIFIED',
	'SETUP_COORDINATOR_PHASE_UNSPECIFIED',
	'SETUP_DKG_PHASE_UNSPECIFIED',
	'SYNC_STATE_UNSPECIFIED',
	'ONCHAIN_SOURCE_HEALTH_UNSPECIFIED',
	'BARK_READINESS_UNSPECIFIED',
] as const;
