import {isMintAvailable, phaseLabel, parseAmounts} from '@client/modules/federation/helpers/federation-setup.helpers';
describe('Federation setup helpers', () => {
	it('splits denominations without rounding uint64 digits', () => {
		expect(parseAmounts(' 1, 9007199254740993  4 ')).toEqual(['1', '9007199254740993', '4']);
	});
	it('shows future phase names without interpreting them', () => expect(phaseLabel('future_phase')).toBe('future_phase'));
	it('treats only standalone and member daemons as serving the mint', () => {
		expect(['standalone', 'member'].every(isMintAvailable)).toBeTrue();
		expect(['setup', 'unreachable', null].some(isMintAvailable)).toBeFalse();
	});
});
