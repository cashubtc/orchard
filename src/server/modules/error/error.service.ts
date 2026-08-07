/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Local Dependencies */
import {OrchardErrorCode, OrchardErrorMessages} from './error.types.js';

@Injectable()
export class ErrorService {
	constructor() {}

	public resolveError(
		logger: Logger,
		error: any,
		tag: string,
		{errord}: {errord: OrchardErrorCode},
	): {code: OrchardErrorCode; details?: string} {
		// logger.error(tag);
		// logger.debug(`${tag}: ${error}`);
		const normalized = this.normalizeError(error);
		const matching_key = Object.keys(OrchardErrorMessages).find((key) => !isNaN(Number(key)) && normalized.code === Number(key));
		return {
			code: matching_key ? Number(matching_key) : errord,
			details: normalized.details,
		};
	}

	private normalizeError(error: any): {code: OrchardErrorCode | null; details?: string} {
		if (error?.code !== undefined && error?.details) {
			return {code: error.code, details: error.details};
		}
		if (typeof error === 'number') {
			return {code: error};
		}
		return {code: null};
	}
}
