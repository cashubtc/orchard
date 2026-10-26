import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {
	decodeSetupInvitation,
	isMintAvailable,
	parseAmounts,
	powerAmounts,
	setupThresholds,
	toOrchardError,
	displayFingerprint,
	setupKeysetSummary,
	setupMemberList,
	setupPaymentRule,
	setupUrlHost,
} from '@client/modules/federation/helpers/federation-setup.helpers';
import {paymentRule} from '@client/modules/federation/helpers/federation-status.helpers';
import {setupInvitationCode} from '@client/modules/federation/helpers/federation-setup.fixtures';
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
	it('follows cdk’s signing, consensus and payment check ranges for each member count', () => {
		// FROST key generation needs two signers even where BFT would allow one
		expect(setupThresholds(3)).toEqual(jasmine.objectContaining({faulty: 0, sign_min: 2, sign_max: 3, sign_default: 2}));
		expect(setupThresholds(2)).toEqual({
			faulty: 0,
			consensus: 2,
			sign_min: 2,
			sign_max: 2,
			sign_default: 2,
			payment_min: 2,
			payment_max: 2,
			payment_default: 2,
		});
		expect(setupThresholds(5)).toEqual(
			jasmine.objectContaining({consensus: 4, sign_min: 2, sign_max: 4, sign_default: 3, payment_min: 4}),
		);
		expect(setupThresholds(7)).toEqual(
			jasmine.objectContaining({faulty: 2, consensus: 5, sign_min: 3, sign_default: 4, payment_max: 7}),
		);
		expect(setupThresholds(64)).toEqual(jasmine.objectContaining({faulty: 21, consensus: 43, sign_min: 22, sign_default: 33}));
	});
	it('lists powers of two as uint64 strings', () => {
		expect(powerAmounts(8)).toEqual(['1', '2', '4', '8', '16', '32', '64', '128']);
		expect(powerAmounts(64).at(-1)).toBe('9223372036854775808');
	});
	it('reads an invitation’s slot, coordinator and expiry, and nothing from malformed text', () => {
		const code = setupInvitationCode(3, 'https://mint.cedar.example', 1792886400);
		expect(decodeSetupInvitation(` ${code} `)).toEqual({
			member_id: 3,
			coordinator_url: 'https://mint.cedar.example',
			expires_at_unix: 1792886400,
		});
		expect(decodeSetupInvitation(`${code}AAAA`)).toBeNull();
		expect(decodeSetupInvitation('cashufedsetupA!!')).toBeNull();
		expect(decodeSetupInvitation('not an invitation')).toBeNull();
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
