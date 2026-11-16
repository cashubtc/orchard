/* Vendor Dependencies */
import type {GraphQLFormattedError} from 'graphql';

/**
 * Shapes a GraphQL error for the response.
 * Production sends only the Orchard error code and the backend diagnostic, so integration errors reach the
 * operator verbatim while stack traces and other internals stay on the server.
 * @param {GraphQLFormattedError} error - The error as formatted by Apollo
 * @param {boolean} is_production - Whether the server is running in production mode
 * @returns {GraphQLFormattedError} The error to send to the client
 */
export function formatGraphQLError(error: GraphQLFormattedError, is_production: boolean): GraphQLFormattedError {
	if (!is_production) return error;
	const details = error.extensions?.details;
	return {
		message: error.message,
		extensions: {
			code: error.extensions?.code,
			...(details && {details}),
		},
	};
}

/**
 * A subscription stream of something being watched: its current payload first, then each update, ending after a final one.
 * A final payload or the client leaving ends it at once, even mid-wait, releasing the watch and the updates once.
 * @param {AsyncIterableIterator<T>} updates - The PubSub iterator the updates arrive on; listened to before the watch starts, so nothing is missed
 * @param {() => Promise<{current: T, release: () => void}>} start - Starts the watch: the payload as it stands now, and what stops the watch
 * @param {(payload: T) => boolean} isFinal - Whether a payload is the last there will be
 * @returns {Promise<AsyncIterableIterator<T>>} The stream to return from the subscription resolver; a watch that can't start stops listening and rethrows
 */
export async function watchStream<T>(
	updates: AsyncIterableIterator<T>,
	start: () => Promise<{current: T; release: () => void}>,
	isFinal: (payload: T) => boolean,
): Promise<AsyncIterableIterator<T>> {
	const pending = updates.next();
	let started: {current: T; release: () => void};
	try {
		started = await start();
	} catch (error) {
		await updates.return?.();
		throw error;
	}
	const {current, release} = started;
	const queue: Promise<IteratorResult<T>>[] = [Promise.resolve({done: false, value: current}), pending];
	let finished = false;
	const finish = async (): Promise<IteratorResult<T>> => {
		if (!finished) {
			finished = true;
			release();
			await updates.return?.();
		}
		return {done: true, value: undefined};
	};
	const stream: AsyncIterableIterator<T> = {
		next: async () => {
			if (finished) return {done: true, value: undefined};
			const result = await (queue.shift() ?? updates.next());
			if (result.done || isFinal(result.value)) await finish();
			return result;
		},
		return: finish,
		[Symbol.asyncIterator]: () => stream,
	};
	return stream;
}
