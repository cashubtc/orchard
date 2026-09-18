/* Native Dependencies */
import {formatOrchardError} from './error.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';

describe('Orchard error formatting', () => {
	it('explains how an operator can enable CDK payment overrides without receiving backend details', () => {
		const error = new OrchardErrors([{message: 'MintQuoteOverrideDisabled', extensions: {code: 40015}}]).errors[0];
		expect(formatOrchardError(error).title).toBe('MINT PAYMENT OVERRIDE DISABLED');
		expect(error.getFullError()).toContain('enable mint_management_rpc.allow_mint_quote_payment_override');
		expect(error.getFullError()).toContain('restart cdk-mintd');
		expect(error.getFullError()).toContain('40015');
	});

	it('uses the same restart guidance for cards and toasts and keeps diagnostics separate', () => {
		const error = new OrchardErrors([
			{message: 'MintRestartRequired', extensions: {code: 40016, details: 'Private backend diagnostic'}},
		]).errors[0];
		const info = formatOrchardError(error);
		expect(info.title).toBe('MINT RESTART REQUIRED');
		expect(info.description).toBe('CDK has configuration changes waiting to be applied. Restart cdk-mintd, then retry.');
		expect(error.getFullError()).toBe(`${info.description} : 40016`);
		expect(error.getFullError()).not.toContain('Private backend diagnostic');
		expect(error.details).toBe('Private backend diagnostic');
	});

	it('also gives existing RPC connection errors friendly toast wording', () => {
		const error = new OrchardErrors([{message: 'MintRpcConnectionError', extensions: {code: 40005}}]).errors[0];
		expect(error.getFullError()).toBe('Orchard was unable to connect to the mint RPC : 40005');
	});

	it('directs generic mint action failures to the event log without claiming a restart is needed', () => {
		const error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006}}]).errors[0];
		expect(error.getFullError()).toBe('The mint RPC action failed. Check the event log for details. : 40006');
	});

	it('retains the message and code for errors outside the public message catalog', () => {
		const error = new OrchardErrors([{message: 'FutureError', extensions: {code: 99999}}]).errors[0];
		expect(formatOrchardError(error).title).toBe('UNKNOWN ERROR');
		expect(error.getFullError()).toBe('FutureError : 99999');
	});
});
