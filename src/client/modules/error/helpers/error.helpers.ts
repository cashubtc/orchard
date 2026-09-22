/* Native Dependencies */
import {type OrchardError} from '@client/modules/error/types/error.types';

export interface ErrorInfo {
	readonly title: string;
	readonly description: string;
}

const error_messages: Readonly<Partial<Record<number, ErrorInfo>>> = {
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
	40015: {
		title: 'MINT PAYMENT OVERRIDE DISABLED',
		description:
			'CDK has disabled manual payment overrides. To use this action, enable mint_management_rpc.allow_mint_quote_payment_override in CDK’s configuration and restart cdk-mintd.',
	},
	40016: {
		title: 'MINT RESTART REQUIRED',
		description: 'CDK has configuration changes waiting to be applied. Restart cdk-mintd, then retry.',
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

/** Resolve public wording shared by error cards and mutation toasts. */
export function formatOrchardError(error: OrchardError): ErrorInfo {
	return (
		error_messages[error.code] ?? {
			title: 'UNKNOWN ERROR',
			description: error.message || 'An unexpected error occurred. Check the event log for details.',
		}
	);
}
