/* Core Dependencies */
import {HttpErrorResponse} from '@angular/common/http';
/* Native Dependencies */
import {type OrchardError} from '@client/modules/error/types/error.types';

export interface ErrorInfo {
	readonly title: string;
	readonly description: string;
}

/** Client-side code for failures that never produced an Orchard error; server codes start at 10001 */
export const CONNECTION_ERROR_CODE = 0;

const error_messages: Readonly<Partial<Record<number, ErrorInfo>>> = {
	[CONNECTION_ERROR_CODE]: {
		title: 'ORCHARD CONNECTION ERROR',
		description: 'Orchard could not get a usable response from its server. Check that it is running, then retry.',
	},
	20001: {
		title: 'BITCOIN RPC ERROR',
		description: 'Orchard was unable to connect to the bitcoin RPC',
	},
	30001: {
		title: 'LIGHTNING RPC ERROR',
		description: 'Orchard was unable to connect to the lightning RPC',
	},
	30002: {
		title: 'LIGHTNING RPC ACTION ERROR',
		description: 'A lightning RPC action failed to execute',
	},
	40001: {
		title: 'MINT PUBLIC API ERROR',
		description: 'Orchard was unable to connect to the public mint API',
	},
	40002: {
		title: 'MINT DATABASE ERROR',
		description: 'Orchard was unable to connect to the mint database',
	},
	40003: {
		title: 'MINT DATABASE SELECT ERROR',
		description: 'Orchard was unable to retrieve data from the mint database',
	},
	40004: {
		title: 'MINT SUPPORT ERROR',
		description: 'This mint type does not support this feature',
	},
	40005: {
		title: 'MINT RPC ERROR',
		description: 'Orchard was unable to connect to the mint RPC',
	},
	40006: {
		title: 'MINT RPC ACTION ERROR',
		description: 'The mint RPC action failed. Check the event log for details.',
	},
	40013: {
		title: 'MINT METRICS ERROR',
		description: 'Orchard was unable to reach the mint metrics endpoint',
	},
	60001: {
		title: 'TAPROOT ASSETS RPC ERROR',
		description: 'Orchard was unable to connect to the taproot assets RPC',
	},
	60002: {
		title: 'TAPROOT ASSETS RPC ACTION ERROR',
		description: 'A taproot assets RPC action failed to execute',
	},
};

/**
 * Resolve wording shared by error cards and mutation toasts.
 * The code supplies the title; the backend's own diagnostic supplies the description when it sent one,
 * so a message we have no catalog entry for still reaches the operator verbatim.
 */
export function formatOrchardError(error: OrchardError): ErrorInfo {
	const catalog_info = error_messages[error.code];
	const title = catalog_info?.title ?? 'UNKNOWN ERROR';
	const fallback_description = error.message || 'An unexpected error occurred. Check the event log for details.';
	return {
		title,
		description: error.details?.trim() || catalog_info?.description || fallback_description,
	};
}

/** Whether an error is the interceptor's session failure, which it handles by routing to /auth. */
export function isAuthRedirectError(error: unknown): boolean {
	const type = (error as {type?: unknown} | null | undefined)?.type;
	return type === 'auth_error' || type === 'refresh_error';
}

/** Describes an error that carries no Orchard code, such as an unreachable server, so error pages never render empty. */
export function toConnectionError(error: unknown): OrchardError {
	if (!(error instanceof HttpErrorResponse)) {
		return {
			code: CONNECTION_ERROR_CODE,
			message: 'OrchardConnectionError',
			details: error instanceof Error ? error.message : undefined,
		};
	}
	const outcome = error.status ? `responded with HTTP ${error.status} ${error.statusText}`.trim() : 'did not respond';
	return {
		code: CONNECTION_ERROR_CODE,
		message: 'OrchardConnectionError',
		details: `Orchard's server ${outcome}. Check that it is running, then retry.`,
	};
}
