/* Core Dependencies */
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
/* Native Dependencies */
import {type OrchardError} from '@client/modules/error/types/error.types';
import {formatOrchardError} from '@client/modules/error/helpers/error.helpers';

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

	/** Display the shared title for this Orchard error code. */
	get error_title(): string {
		return formatOrchardError(this.error).title;
	}

	/** Display the same public explanation used by mutation toasts. */
	get error_description(): string {
		return formatOrchardError(this.error).description;
	}
}
