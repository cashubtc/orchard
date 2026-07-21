/* Core Dependencies */
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
/* Native Dependencies */
import {OrchardError} from '@client/modules/error/types/error.types';

interface ErrorInfo {
	title: string;
	description: string;
}

@Component({
	selector: 'orc-error-resolve',
	standalone: false,
	templateUrl: './error-resolve.component.html',
	styleUrl: './error-resolve.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorResolveComponent {
	@Input() error!: OrchardError;
	@Input() mode: 'default' | 'small' = 'default';

	get error_title(): string {
		const error_info = this.error_messages[this.error.code];
		return error_info ? error_info.title : 'UNKNOWN ERROR';
	}

	get error_description(): string {
		const error_info = this.error_messages[this.error.code];
		if (error_info) {
			return error_info.description;
		}
		return `${this.error.code} : ${this.error.message}`;
	}

	private readonly error_messages: Record<number, ErrorInfo> = {
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
}
