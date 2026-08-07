/* Core Dependencies */
import {ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {GqlExecutionContext} from '@nestjs/graphql';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import {EVENT_LOG_KEY, EventLogMetadata} from '#server/modules/event/event.decorator';
/* Local Dependencies */
import {EventLogActorType} from './event.enums.js';
import {EventLogContext, EventLogError} from './event.interfaces.js';

/**
 * Derive the event log actor type from the request user context.
 * Returns AGENT when the user role is AGENT, USER otherwise.
 */
export function getActorType(user?: {role?: string}): EventLogActorType {
	return user?.role === UserRole.AGENT ? EventLogActorType.AGENT : EventLogActorType.USER;
}

/**
 * Extract event logging context from a GraphQL execution context.
 * Returns null when the handler has no @LogEvent metadata (caller should skip logging).
 * @param {ExecutionContext} context - The NestJS execution context
 * @param {Reflector} reflector - The NestJS reflector
 * @returns {EventLogContext | null} The extracted context or null if no metadata
 */
export function extractEventContext(context: ExecutionContext, reflector: Reflector): EventLogContext | null {
	const metadata = reflector.get<EventLogMetadata>(EVENT_LOG_KEY, context.getHandler());
	if (!metadata) return null;
	const gql_context = GqlExecutionContext.create(context);
	const ctx = gql_context.getContext();
	const args = gql_context.getArgs();
	const user = ctx.req.user;
	const actor_id: string = user?.id ?? 'unknown';
	const actor_type = getActorType(user);
	return {metadata, args, actor_id, actor_type};
}

/**
 * Extract error code and message from a GraphQL error for event logging.
 * @param {any} error - The caught error object
 * @returns {EventLogError} The extracted error information
 */
export function extractEventError(error: any): EventLogError {
	return {
		error_code: error?.extensions?.code ? String(error.extensions.code) : null,
		error_message: error?.extensions?.details ?? error?.message ?? null,
	};
}

/**
 * Get the current timestamp in seconds for event logging.
 * @returns {number} The current Unix timestamp in seconds
 */
export function eventTimestamp(): number {
	return DateTime.now().toUnixInteger();
}
