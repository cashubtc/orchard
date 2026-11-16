/* Core Dependencies */
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {GraphQLFormattedError} from 'graphql';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';

/* Native Dependencies */
import {formatGraphQLError, watchStream} from './graphql.helpers.js';

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

describe('watchStream', () => {
	type Payload = {state: string};
	let pub_sub: PubSub;
	let updates: AsyncIterableIterator<Payload>;
	const release = jest.fn();
	const isFinal = ({state}: Payload) => state === 'FINAL';
	const open = (current: Payload = {state: 'OPEN'}) => watchStream(updates, async () => ({current, release}), isFinal);

	beforeEach(() => {
		jest.clearAllMocks();
		pub_sub = new PubSub();
		updates = pub_sub.asyncIterableIterator<Payload>('watch');
	});

	it('sends the current payload first, then each update, ending after a final one with the watch released once', async () => {
		const stream = await open();
		expect((await stream.next()).value).toEqual({state: 'OPEN'});
		await pub_sub.publish('watch', {state: 'MOVING'});
		expect((await stream.next()).value).toEqual({state: 'MOVING'});
		expect(release).not.toHaveBeenCalled();

		await pub_sub.publish('watch', {state: 'FINAL'});
		expect((await stream.next()).value).toEqual({state: 'FINAL'});
		expect(await stream.next()).toMatchObject({done: true});
		await stream.return!();
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('ends at once on a final current payload', async () => {
		const stream = await open({state: 'FINAL'});
		expect((await stream.next()).value).toEqual({state: 'FINAL'});
		expect(release).toHaveBeenCalledTimes(1);
		expect(await stream.next()).toMatchObject({done: true});
	});

	it('releases the watch at once when the client leaves while waiting for an update', async () => {
		const stream = await open();
		await stream.next();
		const waiting = stream.next();
		await stream.return!();
		expect(release).toHaveBeenCalledTimes(1);
		expect(await waiting).toMatchObject({done: true});
	});

	it('stops listening and rethrows when the watch cannot start', async () => {
		const stop = jest.spyOn(updates, 'return');
		const refused = new Error('Not found');
		await expect(watchStream(updates, () => Promise.reject(refused), isFinal)).rejects.toBe(refused);
		expect(stop).toHaveBeenCalled();
	});
});
