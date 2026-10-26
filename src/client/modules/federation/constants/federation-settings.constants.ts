/* Native Dependencies */
import type {FederationSettingsNut} from '@client/modules/federation/types/federation-settings.types';

/** Reuse a comparison for a minute across pages; the server caches for the same time. */
export const FEDERATION_SETTINGS_REUSE_SECONDS = 60;

export const FEDERATION_SETTINGS_NUT_NUMBERS: Record<FederationSettingsNut, number> = {nut4: 4, nut5: 5};

export const FEDERATION_SETTINGS_LABELS: Record<string, string> = {
	name: 'Name',
	description: 'Description',
	description_long: 'Long description',
	motd: 'Message of the day',
	icon_url: 'Icon URL',
	contact: 'Contact',
	disabled: 'disabled',
	min_amount: 'minimum',
	max_amount: 'maximum',
	options: 'options',
	method: 'method',
};
