/**
 * Get the writable data directory setting (database, crypto key, temp files)
 * DATA_DIR takes precedence; DATABASE_DIR is the legacy name and still honored
 * @returns {string} Data directory as configured, relative to the working directory unless absolute
 */
export const getDataDir = (): string => {
	return process.env.DATA_DIR || process.env.DATABASE_DIR || 'data';
};
