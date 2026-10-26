/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {toConnectionError} from '@client/modules/error/helpers/error.helpers';
import type {OrchardError} from '@client/modules/error/types/error.types';

/** Split denominations without converting their uint64 values to JavaScript numbers. */
export function parseAmounts(text: string): string[] {
	return text
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean);
}

/** Only a daemon in setup mode lacks its API and database; an unreachable management RPC may leave both serving. */
export function isMintAvailable(mode: string | null | undefined): boolean {
	return mode !== 'setup';
}

/** Keep the Orchard error code with the mint's own diagnostic, so operators can report both. */
export function toOrchardError(error: unknown): OrchardError {
	return (error instanceof OrchardErrors && error.errors[0]) || toConnectionError(error);
}
