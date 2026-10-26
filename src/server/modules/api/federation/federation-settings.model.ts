/* Core Dependencies */
import {Field, Int, ObjectType, registerEnumType} from '@nestjs/graphql';

/* Application Dependencies */
import {FederationSettingsComparisonStatus, FederationSettingsComparisonGroup} from '#server/modules/federation/federation-settings.enums';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

registerEnumType(FederationSettingsComparisonStatus, {
	name: 'FederationSettingsComparisonStatus',
	description: 'Whether this member could be compared with the local public mint settings',
});
registerEnumType(FederationSettingsComparisonGroup, {
	name: 'FederationSettingsComparisonGroup',
	description: 'Public metadata or payment configuration containing the difference',
});

@ObjectType({description: 'One public setting that differs from this member'})
export class OrchardFederationSettingsDifference {
	@Field(() => FederationSettingsComparisonGroup, {description: 'Info metadata or payment configuration'})
	group: FederationSettingsComparisonGroup;

	@Field(() => String, {
		description: 'Setting name: an info field, disabled, min_amount, max_amount, options, or method when only one member offers it',
	})
	setting: string;

	@Field(() => Int, {nullable: true, description: 'NUT number (4 for minting, 5 for melting); absent for info fields'})
	nut: number | null;

	@Field(() => String, {nullable: true, description: 'Payment method the setting belongs to'})
	method: string | null;

	@Field(() => String, {nullable: true, description: 'Unit the setting belongs to'})
	unit: string | null;

	@Field(() => String, {nullable: true, description: 'This member value as text; absent when empty'})
	this_member_value: string | null;

	@Field(() => String, {nullable: true, description: 'The other member value as text; absent when empty'})
	their_value: string | null;
}

@ObjectType({description: 'Comparison of one member with the local public mint settings'})
export class OrchardFederationMemberSettingsComparison {
	@Field(() => Int, {description: 'Federation member slot'})
	member_id: number;

	@Field(() => Boolean, {description: 'Whether this is the locally configured federation member'})
	local: boolean;

	@Field(() => String, {description: 'Public mint URL reported by the federation configuration'})
	public_mint_url: string;

	@Field(() => String, {description: 'Federation API URL reported by the federation configuration'})
	federation_api_url: string;

	@Field(() => FederationSettingsComparisonStatus, {description: 'Comparison result; a missing local baseline never counts as a match'})
	status: FederationSettingsComparisonStatus;

	@Field(() => String, {nullable: true, description: "The member's fetch error, or why it can't be compared"})
	error: string | null;

	@Field(() => [OrchardFederationSettingsDifference], {description: 'Public fields that differ; empty when matching or not comparable'})
	differences: OrchardFederationSettingsDifference[];
}

@ObjectType({description: 'Public mint settings compared with this member, cached for about sixty seconds'})
export class OrchardFederationSettingsComparison {
	@Field(() => String, {description: 'Federation whose public settings were compared'})
	federation_id: string;

	@Field(() => Int, {description: 'Member used as the comparison baseline'})
	local_member_id: number;

	@Field(() => Int, {description: 'Member that wallets ask first for quotes unless configured otherwise'})
	default_quote_member_id: number;

	@Field(() => UnixTimestamp, {description: 'When this comparison finished'})
	checked_at: number;

	@Field(() => Boolean, {description: 'Whether the local member public info could be read as the baseline'})
	baseline_available: boolean;

	@Field(() => [OrchardFederationMemberSettingsComparison], {
		description: 'Results for every configured member, including the local member',
	})
	members: OrchardFederationMemberSettingsComparison[];
}
