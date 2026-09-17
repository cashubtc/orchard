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
	transform(unit: string, title: boolean = false): string {
		if (unit === null || unit === undefined) return '';
		const meta = getUnitMeta(unit);
		/* Custom units keep the mint's own casing; known units title-case to their currency code */
		return title && meta.family !== 'custom' ? meta.code.toUpperCase() : meta.code;
	}
}
