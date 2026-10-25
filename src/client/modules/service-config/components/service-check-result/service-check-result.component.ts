/* Core Dependencies */
import {Component, ChangeDetectionStrategy, input} from '@angular/core';

/* Vendor Dependencies */
import {ClipboardModule} from '@angular/cdk/clipboard';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Shared Dependencies */
import type {OrchardConnectionCheck} from '@shared/generated.types';

@Component({
	selector: 'orc-service-check-result',
	imports: [ClipboardModule, MatButtonModule, MatIconModule],
	templateUrl: './service-check-result.component.html',
	styleUrl: './service-check-result.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCheckResultComponent {
	public readonly result = input.required<OrchardConnectionCheck>();
}
