import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {isMintAvailable, parseAmounts, toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';
describe('Federation setup helpers', () => {
	it('splits denominations without rounding uint64 digits', () => {
		expect(parseAmounts(' 1, 9007199254740993  4 ')).toEqual(['1', '9007199254740993', '4']);
	});
	it('treats only standalone and member daemons as serving the mint', () => {
		expect(['standalone', 'member', 'unreachable'].every(isMintAvailable)).toBeTrue();
		expect(isMintAvailable('setup')).toBeFalse();
	});
	it('keeps the Orchard error code and the mint diagnostic', () => {
		const error = new OrchardErrors([{message: 'Busy', extensions: {code: 40015, details: 'the setup is certified'}}]);
		expect(toOrchardError(error)).toEqual(jasmine.objectContaining({code: 40015, details: 'the setup is certified'}));
	});
});
