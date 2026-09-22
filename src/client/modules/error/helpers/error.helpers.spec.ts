/* Core Dependencies */
import {HttpErrorResponse} from '@angular/common/http';
/* Native Dependencies */
import {formatOrchardError, isAuthRedirectError} from './error.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';

describe('Orchard error formatting', () => {
	it('shows the backend diagnostic as the description, keeping the title from the code', () => {
		const details = 'A configuration apply is pending; restart cdk-mintd before making management RPC changes';
		const error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006, details}}]).errors[0];
		const info = formatOrchardError(error);
		expect(info.title).toBe('MINT RPC ACTION ERROR');
		expect(info.description).toBe(details);
		expect(error.getFullError()).toBe(`${details} : 40006`);
	});

	it('falls back to the catalog description when the backend sent no details', () => {
		const error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006}}]).errors[0];
		expect(error.getFullError()).toBe('The mint RPC action failed. Check the event log for details. : 40006');
	});

	it('falls back to the catalog description when the details are blank', () => {
		const error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006, details: '   '}}]).errors[0];
		expect(error.getFullError()).toBe('The mint RPC action failed. Check the event log for details. : 40006');
	});

	it('also gives existing RPC connection errors friendly toast wording', () => {
		const error = new OrchardErrors([{message: 'MintRpcConnectionError', extensions: {code: 40005}}]).errors[0];
		expect(error.getFullError()).toBe('Orchard was unable to connect to the mint RPC : 40005');
	});

	it('retains the message and code for errors outside the public message catalog', () => {
		const error = new OrchardErrors([{message: 'FutureError', extensions: {code: 99999}}]).errors[0];
		expect(formatOrchardError(error).title).toBe('UNKNOWN ERROR');
		expect(error.getFullError()).toBe('FutureError : 99999');
	});

	it('prefers the backend diagnostic over the message for an uncatalogued code', () => {
		const error = new OrchardErrors([{message: 'FutureError', extensions: {code: 99999, details: 'backend said this'}}]).errors[0];
		const info = formatOrchardError(error);
		expect(info.title).toBe('UNKNOWN ERROR');
		expect(info.description).toBe('backend said this');
	});
});

describe('isAuthRedirectError', () => {
	it('matches the error interceptor session failures', () => {
		expect(isAuthRedirectError({type: 'auth_error', response: {}})).toBeTrue();
		expect(isAuthRedirectError({type: 'refresh_error', response: {}})).toBeTrue();
	});

	it('ignores transport failures, which also carry a type property', () => {
		const transport_error = new HttpErrorResponse({status: 502, url: '/proxy/api'});
		expect('type' in transport_error).toBeTrue();
		expect(isAuthRedirectError(transport_error)).toBeFalse();
	});

	it('ignores Orchard errors and non-objects', () => {
		const orchard_error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006}}]);
		for (const error of [orchard_error, null, undefined, 'auth_error', 40006]) expect(isAuthRedirectError(error)).toBeFalse();
	});
});
