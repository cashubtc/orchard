/* Shared Dependencies */
import {
	FederationSettingsComparisonGroup,
	FederationSettingsComparisonStatus,
	type OrchardFederationSettingsComparison,
	type OrchardFederationSettingsDifference,
} from '@shared/generated.types';

/** Return a fresh three-member public settings comparison. */
export function settingsComparison(): OrchardFederationSettingsComparison {
	return {
		federation_id: 'federation',
		local_member_id: 1,
		default_quote_member_id: 1,
		checked_at: 1792929600,
		baseline_available: true,
		members: [1, 2, 3].map((member_id) => ({
			member_id,
			local: member_id === 1,
			public_mint_url: `https://mint${member_id}.example`,
			federation_api_url: `https://peer${member_id}.example`,
			status: FederationSettingsComparisonStatus.Matches,
			error: null,
			differences: [],
		})),
	};
}

/** Return one difference, defaulting to a NUT-04 bolt11 sat maximum. */
export function settingsDifference(overrides: Partial<OrchardFederationSettingsDifference> = {}): OrchardFederationSettingsDifference {
	return {
		group: FederationSettingsComparisonGroup.Config,
		setting: 'max_amount',
		nut: 4,
		method: 'bolt11',
		unit: 'sat',
		this_member_value: '10',
		their_value: '20',
		...overrides,
	};
}
