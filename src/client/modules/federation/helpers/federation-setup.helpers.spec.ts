import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {
	isMintAvailable,
	parseAmounts,
	toOrchardError,
	displayFingerprint,
	setupKeysetSummary,
	setupMemberList,
	setupPaymentRule,
	setupUrlHost,
} from '@client/modules/federation/helpers/federation-setup.helpers';
import {paymentRule} from '@client/modules/federation/helpers/federation-status.helpers';
describe('Federation setup helpers', () => {
	const rule = (mint_quotes: unknown, melt_quotes: unknown = mint_quotes): string =>
		setupPaymentRule(JSON.stringify({payment_observation_policy: {mint_quotes, melt_quotes}}));
	it('groups identity fingerprints without changing unknown formats', () => {
		expect(displayFingerprint('4b1d9e60c2a871f3')).toBe('4b1d 9e60 c2a8 71f3');
		expect(displayFingerprint('future:identity')).toBe('future:identity');
	});
	it('words proposal payment rules as the dashboard does', () => {
		const quorum = paymentRule({kind: 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM', required_observations: 2});
		const development = paymentRule({
			kind: 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION',
			required_observations: 1,
		});
		expect(rule({type: 'member_quorum', required: 2})).toBe(quorum);
		expect(rule({type: 'development_single_observation'})).toBe(development);
		expect(rule({type: 'member_quorum', required: 2}, {type: 'development_single_observation'})).toBe(
			`Incoming: ${quorum} · Outgoing: ${development}`,
		);
	});
	it('keeps unknown or missing payment policies readable', () => {
		expect(rule({type: 'future_policy'})).toBe('future_policy');
		expect(rule({type: 'future_policy', required: 2})).toBe(paymentRule({kind: 'future_policy', required_observations: 2}));
		expect(setupPaymentRule('{}')).toBe(paymentRule(null));
		expect(setupPaymentRule('not json')).toBe(paymentRule(null));
	});
	it('splits denominations without rounding uint64 digits', () => {
		expect(parseAmounts(' 1, 9007199254740993  4 ')).toEqual(['1', '9007199254740993', '4']);
	});
	it('treats only standalone and member daemons as serving the mint', () => {
		expect(['standalone', 'member', 'unreachable'].every(isMintAvailable)).toBeTrue();
		expect(isMintAvailable('setup')).toBeFalse();
	});
	it('summarizes a keyset by its range and fee without losing uint64 precision', () => {
		expect(setupKeysetSummary('sat', ['128', '1', '9007199254740993', '2'], '0')).toBe('sat · 1 to 9007199254740993 · no fee');
		expect(setupKeysetSummary(' usd ', ['5'], '100')).toBe('usd · 5 · 100 ppk fee');
		expect(setupKeysetSummary('sat', ['8', 'x2'], '')).toBe('sat · 8 to x2 · no fee');
	});
	it('shortens member URLs to their host and lists approvals in words', () => {
		expect(setupUrlHost('https://mint.oak.example:3338/path')).toBe('mint.oak.example:3338');
		expect(setupUrlHost('not a url')).toBe('not a url');
		expect(setupMemberList([])).toBe('none yet');
		expect(setupMemberList([3])).toBe('member 3');
		expect(setupMemberList([1, 2, 5])).toBe('members 1, 2 and 5');
	});
	it('keeps the Orchard error code and the mint diagnostic', () => {
		const error = new OrchardErrors([{message: 'Busy', extensions: {code: 40015, details: 'the setup is certified'}}]);
		expect(toOrchardError(error)).toEqual(jasmine.objectContaining({code: 40015, details: 'the setup is certified'}));
	});
});
