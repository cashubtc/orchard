/** Setup mutations may wait for another member over the federation network. */
export const SETUP_ACTION_TIMEOUT_MS = 120000;
/** A member's public /v1/info is small; an offline member shouldn't hold the comparison long. */
export const FEDERATION_SETTINGS_FETCH_TIMEOUT_MS = 5000;
export const FEDERATION_SETTINGS_CACHE_MS = 60000;
export const FEDERATION_SETTINGS_INFO_FIELDS = ['name', 'description', 'description_long', 'motd', 'icon_url', 'contact'] as const;
export const FEDERATION_SETTINGS_METHOD_FIELDS = ['min_amount', 'max_amount', 'options'] as const;
export const FEDERATION_SETTINGS_NUTS = [4, 5] as const;
/** Longest upstream error body relayed from a member, so a proxy's HTML page doesn't fill the UI. */
export const FEDERATION_SETTINGS_ERROR_LENGTH = 200;
