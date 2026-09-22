/* Core Dependencies */
import {describe, expect, it} from '@jest/globals';
import type {GraphQLFormattedError} from 'graphql';

/* Native Dependencies */
import {formatGraphQLError} from './graphql.helpers.js';

describe('formatGraphQLError', () => {
	const details = 'Mint quote state override is disabled';
	const error: GraphQLFormattedError = {
		message: 'MintRpcActionError',
		path: ['mint_nut04_quote_update'],
		extensions: {code: 40006, details, stacktrace: ['OrchardApiError: MintRpcActionError', '    at MintMintQuoteService']},
	};

	it('passes the backend diagnostic through in production', () => {
		expect(formatGraphQLError(error, true)).toEqual({message: 'MintRpcActionError', extensions: {code: 40006, details}});
	});

	it('keeps stack traces and other internals out of production responses', () => {
		const formatted = formatGraphQLError(error, true);
		expect(formatted.extensions).not.toHaveProperty('stacktrace');
		expect(formatted).not.toHaveProperty('path');
	});

	it('omits details in production when the error carries none', () => {
		const formatted = formatGraphQLError({message: 'AuthenticationError', extensions: {code: 10002}}, true);
		expect(formatted).toEqual({message: 'AuthenticationError', extensions: {code: 10002}});
	});

	it('returns the full error outside production', () => {
		expect(formatGraphQLError(error, false)).toBe(error);
	});
});
