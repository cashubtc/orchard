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
