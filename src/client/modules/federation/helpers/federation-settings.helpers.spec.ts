import {FederationSettingsComparisonGroup as Group, FederationSettingsComparisonStatus as Status} from '@shared/generated.types';
import {settingsComparison, settingsDifference} from './federation-settings.fixtures';
import {
	federationDefaultQuoteLimitsDiffer,
	federationSettingKey,
	federationSettingsHints,
	federationSettingsOverview,
	federationSettingsSummary,
} from './federation-settings.helpers';

describe('Federation settings helpers', () => {
	it('counts only the displayed group and never calls an unavailable member matching', () => {
		const result = settingsComparison();
		result.members[1].status = Status.Differs;
		result.members[1].differences = [
			settingsDifference({group: Group.Info, setting: 'name', nut: null, method: null, unit: null, their_value: 'Two'}),
		];
		result.members[2].status = Status.Unavailable;
		expect(federationSettingsSummary(result, Group.Info)).toBe('Differs from member 2 on 1 setting');
		expect(federationSettingsSummary(result, Group.Config)).toBe('Matches member 2');
		expect(federationSettingsOverview(result)).toBe('1 member differs · 1 not compared');
		result.baseline_available = false;
		expect(federationSettingsSummary(result, Group.Info)).toBe('Settings not compared');
		expect(federationSettingsOverview(result)).toBe('Not compared');
		expect(federationSettingsHints(result).size).toBe(0);
	});

	it('lists matching members readably', () => {
		expect(federationSettingsSummary(settingsComparison(), Group.Info)).toBe('Matches members 2 and 3');
		expect(federationSettingsOverview(settingsComparison())).toBe('All members match');
	});

	it('indexes hints by setting scope with readable values', () => {
		const result = settingsComparison();
		result.members[1].differences = [
			settingsDifference({their_value: '18446744073709551615'}),
			settingsDifference({setting: 'disabled', method: null, unit: null, this_member_value: 'false', their_value: 'true'}),
			settingsDifference({group: Group.Info, setting: 'motd', nut: null, method: null, unit: null, their_value: null}),
		];
		const hints = federationSettingsHints(result);
		expect(hints.get(federationSettingKey('max_amount', 4, 'bolt11', 'sat'))?.[0]).toEqual(
			jasmine.objectContaining({member_id: 2, value: '18446744073709551615', label: 'NUT-04 bolt11 sat maximum'}),
		);
		expect(hints.get(federationSettingKey('disabled', 4))?.[0].value).toBe('Disabled');
		expect(hints.get(federationSettingKey('motd'))?.[0]).toEqual(
			jasmine.objectContaining({label: 'Message of the day', value: 'Empty'}),
		);
	});

	it('lists a method only a peer offers beside its NUT and keeps custom identities apart', () => {
		const result = settingsComparison();
		result.members[2].differences = [
			settingsDifference({setting: 'method', method: 'custom"method', this_member_value: 'false', their_value: 'true'}),
		];
		const hints = federationSettingsHints(result);
		expect(hints.get(federationSettingKey('missing_methods', 4))?.[0]).toEqual(
			jasmine.objectContaining({member_id: 3, label: 'NUT-04 custom"method sat method', value: 'Available'}),
		);
		expect(hints.get(federationSettingKey('method', 4, 'custom"method', 'sat'))).toHaveSize(1);
		expect(hints.has(federationSettingKey('method', 4, 'custom', 'method"sat'))).toBeFalse();
	});

	it('flags the default quote member whichever side of the comparison it is on', () => {
		const result = settingsComparison();
		result.members[1].differences = [settingsDifference()];
		expect(federationDefaultQuoteLimitsDiffer(result)).toBeTrue();
		result.local_member_id = 3;
		result.members[0].local = false;
		result.members[2].local = true;
		result.members[1].differences = [];
		result.members[0].differences = [settingsDifference({setting: 'min_amount'})];
		expect(federationDefaultQuoteLimitsDiffer(result)).toBeTrue();
		expect(
			federationSettingsHints(result).get(federationSettingKey('min_amount', 4, 'bolt11', 'sat'))?.[0].default_quote_member,
		).toBeTrue();
		result.default_quote_member_id = 2;
		expect(federationDefaultQuoteLimitsDiffer(result)).toBeFalse();
	});
});
