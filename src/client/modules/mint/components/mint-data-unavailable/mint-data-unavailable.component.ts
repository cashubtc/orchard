/* Core Dependencies */
import {Component, ChangeDetectionStrategy} from '@angular/core';
import {RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';

@Component({
	selector: 'orc-mint-data-unavailable',
	imports: [RouterLink, MatIconModule, OrcPublicModule],
	templateUrl: './mint-data-unavailable.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintDataUnavailableComponent {}
