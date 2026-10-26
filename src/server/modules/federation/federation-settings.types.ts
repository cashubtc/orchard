/* Native Dependencies */
import type {
	FederationSettingsComparisonGroup,
	FederationSettingsComparisonStatus,
} from '#server/modules/federation/federation-settings.enums';

export type FederationSettingsValue =
	null | boolean | number | string | FederationSettingsValue[] | {[key: string]: FederationSettingsValue};

export interface FederationSettingsDifference {
	group: FederationSettingsComparisonGroup;
	setting: string;
	nut: number | null;
	method: string | null;
	unit: string | null;
	this_member_value: string | null;
	their_value: string | null;
}

export interface FederationMemberSettingsComparison {
	member_id: number;
	local: boolean;
	public_mint_url: string;
	federation_api_url: string;
	status: FederationSettingsComparisonStatus;
	error: string | null;
	differences: FederationSettingsDifference[];
}

export interface FederationSettingsComparison {
	federation_id: string;
	local_member_id: number;
	default_quote_member_id: number;
	checked_at: number;
	baseline_available: boolean;
	members: FederationMemberSettingsComparison[];
}

export interface FederationPublicMethod {
	method: string;
	unit: string;
	settings: Record<string, FederationSettingsValue>;
}

export interface FederationPublicSettings {
	info: Record<string, FederationSettingsValue>;
	nuts: Record<number, {disabled: boolean; methods: Map<string, FederationPublicMethod>}>;
}

export interface FederationMemberSettingsRead {
	settings: FederationPublicSettings | null;
	// Set only when the read failed or can't be made
	status: FederationSettingsComparisonStatus | null;
	error: string | null;
}
