export enum UserRole {
	ADMIN = 'admin',
	MANAGER = 'manager',
	READER = 'reader',
	AGENT = 'agent',
}

/**
 * Why a user session ended. A live session has no end reason.
 * The user_sessions table only accepts these values, so a new reason needs a migration.
 */
export enum UserSessionEndReason {
	REPLACED = 'replaced', // the user signed in again, which started a new session
	SIGNED_OUT = 'signed_out', // the user signed out
	PASSWORD_CHANGED = 'password_changed', // the user changed their password, which started a new session
	DEACTIVATED = 'deactivated', // an admin deactivated the user
}
