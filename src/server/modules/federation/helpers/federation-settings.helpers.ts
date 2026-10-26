/* Native Dependencies */
import {FederationSettingsComparisonGroup} from '#server/modules/federation/federation-settings.enums';
import {
	FEDERATION_SETTINGS_INFO_FIELDS,
	FEDERATION_SETTINGS_METHOD_FIELDS,
	FEDERATION_SETTINGS_NUTS,
} from '#server/modules/federation/constants/federation.constants';
import type {
	FederationPublicMethod,
	FederationPublicSettings,
	FederationSettingsDifference,
	FederationSettingsValue,
} from '#server/modules/federation/federation-settings.types';

/** Read JSON numbers without losing the original digits of unsafe integer limits. */
export function parseFederationPublicInfo(body: string): unknown {
	return JSON.parse(body, (_key: string, value: unknown, context?: {source?: string}): unknown => {
		if (typeof value !== 'number' || (Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))))
			return value;
		if (context?.source) return context.source;
		throw new Error('Mint info contains a number that this Node.js version cannot parse exactly');
	}) as unknown;
}

/** Identify JSON objects without treating arrays or null as records. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Canonicalize object ordering and treat missing, null and empty values alike. */
function normalizeValue(value: unknown): FederationSettingsValue {
	if (value == null || value === '') return null;
	if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
	if (Array.isArray(value)) return value.length ? value.map(normalizeValue) : null;
	if (!isRecord(value)) throw new Error('Invalid public mint setting');
	const entries = Object.keys(value)
		.sort()
		.map((key): [string, FederationSettingsValue] => [key, normalizeValue(value[key])])
		.filter(([, item]) => item !== null);
	return entries.length ? Object.fromEntries(entries) : null;
}

/** Show a setting as text; structured values stay compact JSON. */
function displayValue(value: FederationSettingsValue): string | null {
	if (value === null) return null;
	return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Select only public metadata and NUT-04/05 settings that members can compare. */
export function readFederationPublicSettings(value: unknown): FederationPublicSettings {
	if (!isRecord(value)) throw new Error('Mint info must be a JSON object');
	if (value.contact != null && !Array.isArray(value.contact)) throw new Error('Mint info contact must be an array');
	const contact = (value.contact as unknown[] | undefined)
		?.map(normalizeValue)
		.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
	const info = Object.fromEntries(
		FEDERATION_SETTINGS_INFO_FIELDS.map((field) => [field, normalizeValue(field === 'contact' ? contact : value[field])]),
	);
	if (value.nuts != null && !isRecord(value.nuts)) throw new Error('Mint info nuts must be an object');
	const nuts = (value.nuts ?? {}) as Record<string, unknown>;
	const settings: FederationPublicSettings = {info, nuts: {}};
	for (const nut of FEDERATION_SETTINGS_NUTS) {
		const config = nuts[nut] ?? {};
		if (!isRecord(config)) throw new Error(`Mint info nuts.${nut} must be an object`);
		if (config.methods != null && !Array.isArray(config.methods)) throw new Error(`Mint info nuts.${nut}.methods must be an array`);
		const methods = new Map<string, FederationPublicMethod>();
		for (const method of (config.methods ?? []) as unknown[]) {
			if (!isRecord(method) || typeof method.method !== 'string' || typeof method.unit !== 'string')
				throw new Error(`Mint info nuts.${nut}.methods must identify each method and unit`);
			const key = JSON.stringify([method.method, method.unit]);
			if (methods.has(key)) throw new Error(`Mint info nuts.${nut}.methods lists ${method.method} ${method.unit} twice`);
			const values = Object.fromEntries(FEDERATION_SETTINGS_METHOD_FIELDS.map((field) => [field, normalizeValue(method[field])]));
			methods.set(key, {method: method.method, unit: method.unit, settings: values});
		}
		// NUT-04/05 treat an absent flag as enabled
		settings.nuts[nut] = {disabled: config.disabled === true, methods};
	}
	return settings;
}

/** List the settings where a member differs from the local baseline. */
export function compareFederationPublicSettings(
	local: FederationPublicSettings,
	peer: FederationPublicSettings,
): FederationSettingsDifference[] {
	const differences: FederationSettingsDifference[] = [];
	const compare = (
		scope: Omit<FederationSettingsDifference, 'this_member_value' | 'their_value'>,
		local_value: FederationSettingsValue,
		peer_value: FederationSettingsValue,
	): void => {
		if (JSON.stringify(local_value) !== JSON.stringify(peer_value))
			differences.push({...scope, this_member_value: displayValue(local_value), their_value: displayValue(peer_value)});
	};
	const info = {group: FederationSettingsComparisonGroup.info, nut: null, method: null, unit: null};
	for (const setting of FEDERATION_SETTINGS_INFO_FIELDS) compare({...info, setting}, local.info[setting], peer.info[setting]);
	for (const nut of FEDERATION_SETTINGS_NUTS) {
		const config = {group: FederationSettingsComparisonGroup.config, nut, method: null, unit: null};
		compare({...config, setting: 'disabled'}, local.nuts[nut].disabled, peer.nuts[nut].disabled);
		const keys = [...new Set([...local.nuts[nut].methods.keys(), ...peer.nuts[nut].methods.keys()])].sort();
		for (const key of keys) {
			const local_method = local.nuts[nut].methods.get(key);
			const peer_method = peer.nuts[nut].methods.get(key);
			const {method, unit} = (local_method ?? peer_method) as FederationPublicMethod;
			const scope = {...config, method, unit};
			if (!local_method || !peer_method) {
				compare({...scope, setting: 'method'}, !!local_method, !!peer_method);
				continue;
			}
			for (const setting of FEDERATION_SETTINGS_METHOD_FIELDS)
				compare({...scope, setting}, local_method.settings[setting], peer_method.settings[setting]);
		}
	}
	return differences;
}
