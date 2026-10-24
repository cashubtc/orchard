/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {toConnectionError} from '@client/modules/error/helpers/error.helpers';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {FEDERATION_PHASE_LABELS} from '@client/modules/federation/constants/federation.constants';

/** Split denominations without converting their uint64 values to JavaScript numbers. */
export function parseAmounts(text: string): string[] {
	return text
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean);
}

/** Translate known phases and preserve future CDK values verbatim. */
export function phaseLabel(phase: string): string {
	return FEDERATION_PHASE_LABELS[phase] ?? phase;
}

/** Whether the mint serves its API, RPC and database; a daemon in setup mode or out of reach doesn't. */
export function isMintAvailable(mode: string | null | undefined): boolean {
	return mode === 'standalone' || mode === 'member';
}

/** Keep the Orchard error code with the mint's own diagnostic, so operators can report both. */
export function toOrchardError(error: unknown): OrchardError {
	return (error instanceof OrchardErrors && error.errors[0]) || toConnectionError(error);
}
