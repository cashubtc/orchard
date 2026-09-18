/* Application Dependencies */
import {type OrchardRes} from '@client/modules/api/types/api.types';
/* Native Dependencies */
import {formatOrchardError} from '@client/modules/error/helpers/error.helpers';

export class OrchardErrors {
	public errors: OrchardError[];

	constructor(errors: OrchardRes<unknown>['errors']) {
		this.errors = errors
			? errors.map((error) => new OrchardError(error.message, error.extensions.code, error.extensions?.details ?? undefined))
			: [];
	}
}

class OrchardError {
	public message: string;
	public code: number;
	public details?: string;

	constructor(message: string, code: number, details?: string) {
		this.message = message;
		this.code = code;
		this.details = details;
	}

	/** Format public guidance and the support code; raw diagnostics remain separate. */
	public getFullError(): string {
		return `${formatOrchardError(this).description} : ${this.code}`;
	}
}
