export const FEDERATION_SETTINGS_COMPARISON_QUERY = /* GraphQL */ `
	query FederationSettingsComparison($refresh: Boolean!) {
		federation_settings_comparison(refresh: $refresh) {
			federation_id
			local_member_id
			default_quote_member_id
			checked_at
			baseline_available
			members {
				member_id
				local
				public_mint_url
				federation_api_url
				status
				error
				differences {
					group
					setting
					nut
					method
					unit
					this_member_value
					their_value
				}
			}
		}
	}
`;
