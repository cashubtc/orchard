/* Core Dependencies */
import {Pipe, PipeTransform} from '@angular/core';
/* Native Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';

@Pipe({
	name: 'localUnit',
	standalone: false,
	pure: true,
})
export class LocalUnitPipe implements PipeTransform {
	/** A mint unit as shown everywhere: its display code, uppercase; mints keep units lowercase, so casing carries no meaning */
	transform(unit: string): string {
		if (unit === null || unit === undefined) return '';
		return getUnitMeta(unit).code.toUpperCase();
	}
}
