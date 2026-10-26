/* Native Dependencies */
import {FEDERATION_SETTINGS_LABELS} from '@client/modules/federation/constants/federation-settings.constants';
import type {FederationSettingHint} from '@client/modules/federation/types/federation-settings.types';

/* Shared Dependencies */
import type {
	FederationSettingsComparisonGroup,
	OrchardFederationSettingsComparison,
	OrchardFederationSettingsDifference,
} from '@shared/generated.types';

/** Join member identifiers in a short readable list. */
function memberList(member_ids: readonly number[]): string {
	return new Intl.ListFormat('en', {style: 'long', type: 'conjunction'}).format(member_ids.map(String));
}

/** Key a setting by its scope, as the hint component looks it up. */
export function federationSettingKey(
	setting: string,
	nut: number | null = null,
	method: string | null = null,
	unit: string | null = null,
): string {
	return JSON.stringify([setting, nut, method, unit]);
}

/** Summarize only the settings shown on this page, keeping unavailable peers out of matches. */
export function federationSettingsSummary(
	comparison: OrchardFederationSettingsComparison | null,
	group: `${FederationSettingsComparisonGroup}`,
): string {
	if (!comparison?.baseline_available) return 'Settings not compared';
	const compared = comparison.members.filter((member) => !member.local && (member.status === 'matches' || member.status === 'differs'));
	const matching = compared.filter((member) => !member.differences.some((difference) => difference.group === group));
	const summaries = compared.flatMap((member) => {
		const count = member.differences.filter((difference) => difference.group === group).length;
		return count ? [`Differs from member ${member.member_id} on ${count} ${count === 1 ? 'setting' : 'settings'}`] : [];
	});
	if (matching.length)
		summaries.push(`Matches ${matching.length === 1 ? 'member' : 'members'} ${memberList(matching.map((member) => member.member_id))}`);
	return summaries.join(' · ') || 'Settings not compared';
}

/** Give the overview a concise result without treating failed reads as agreement. */
export function federationSettingsOverview(comparison: OrchardFederationSettingsComparison | null): string {
	if (!comparison?.baseline_available) return 'Not compared';
	const peers = comparison.members.filter((member) => !member.local);
	const differing = peers.filter((member) => member.status === 'differs').length;
	const unchecked = peers.filter((member) => member.status !== 'matches' && member.status !== 'differs').length;
	const not_compared = unchecked ? ` · ${unchecked} not compared` : '';
	if (differing) return `${differing} ${differing === 1 ? 'member differs' : 'members differ'}${not_compared}`;
	return unchecked || !peers.length ? 'Not compared' : 'All members match';
}

/** Show another member's value in words for flags and method availability. */
function settingValue(difference: OrchardFederationSettingsDifference): string {
	const value = difference.their_value;
	if (difference.setting === 'disabled') return value === 'true' ? 'Disabled' : 'Enabled';
	if (difference.setting === 'method') return value === 'true' ? 'Available' : 'Not available';
	return value ?? 'Empty';
}

/** Name a setting for hints shown away from its own control. */
function settingLabel(difference: OrchardFederationSettingsDifference): string {
	const label = FEDERATION_SETTINGS_LABELS[difference.setting] ?? difference.setting;
	if (difference.nut === null || difference.nut === undefined) return label;
	return [`NUT-0${difference.nut}`, difference.method, difference.unit, label].filter(Boolean).join(' ');
}

/** Index every peer difference by setting, adding methods only a peer offers to their NUT's list. */
export function federationSettingsHints(comparison: OrchardFederationSettingsComparison | null): Map<string, FederationSettingHint[]> {
	const hints = new Map<string, FederationSettingHint[]>();
	if (!comparison?.baseline_available) return hints;
	const add = (key: string, hint: FederationSettingHint): void => {
		hints.set(key, [...(hints.get(key) ?? []), hint]);
	};
	for (const member of comparison.members.filter((item) => !item.local)) {
		for (const difference of member.differences) {
			const hint = {
				member_id: member.member_id,
				label: settingLabel(difference),
				value: settingValue(difference),
				default_quote_member:
					member.member_id === comparison.default_quote_member_id && ['min_amount', 'max_amount'].includes(difference.setting),
			};
			const nut = difference.nut ?? null;
			add(federationSettingKey(difference.setting, nut, difference.method ?? null, difference.unit ?? null), hint);
			// A method only a peer offers has no local control, so it's listed beside its NUT
			if (difference.setting === 'method' && difference.this_member_value !== 'true')
				add(federationSettingKey('missing_methods', nut), hint);
		}
	}
	return hints;
}

/** Whether the default quote member's limits differ, whichever side of the comparison it's on. */
export function federationDefaultQuoteLimitsDiffer(comparison: OrchardFederationSettingsComparison | null): boolean {
	if (!comparison?.baseline_available) return false;
	const default_id = comparison.default_quote_member_id;
	return comparison.members.some(
		(member) =>
			!member.local &&
			(member.member_id === default_id || comparison.local_member_id === default_id) &&
			member.differences.some((difference) => ['min_amount', 'max_amount'].includes(difference.setting)),
	);
}
