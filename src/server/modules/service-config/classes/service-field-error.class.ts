/* Native Dependencies */
import type {ServiceFieldName} from '#server/modules/service-config/types/service-config.types';

/** A connection input Orchard rejected before contacting the service, tied to the field that caused it. */
export class ServiceFieldError extends Error {
	constructor(
		message: string,
		public readonly field: ServiceFieldName,
		public readonly title?: string,
	) {
		super(message);
	}
}
