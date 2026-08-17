import {GraphQLError} from 'graphql';
import {OrchardErrorCode, OrchardErrorMessages} from '#server/modules/error/error.types';

export class OrchardApiError extends GraphQLError {
	constructor(error: OrchardErrorCode | {code: OrchardErrorCode; details?: string}) {
		const code = typeof error === 'number' ? error : error.code;
		const details = typeof error === 'object' ? error.details : undefined;

		super(OrchardErrorMessages[code], {
			extensions: {
				code: code,
				...(details && {details}),
			},
		});
	}
}
