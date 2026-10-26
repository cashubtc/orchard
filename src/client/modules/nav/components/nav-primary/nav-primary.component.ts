/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
/* Application Dependencies */
import {EventData} from 'src/client/modules/event/classes/event-data.class';

@Component({
	selector: 'orc-nav-primary',
	standalone: false,
	templateUrl: './nav-primary.component.html',
	styleUrl: './nav-primary.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavPrimaryComponent {
	/* Inputs */
	public user_name = input.required<string | null>();
	public user_error = input.required<boolean>();
	public active_section = input.required<string>();
	public active_event = input.required<EventData | null>();
	public enabled_bitcoin = input.required<boolean>();
	public enabled_lightning = input.required<boolean>();
	public enabled_mint = input.required<boolean>();
	public enabled_ecash = input.required<boolean>();
	public online_bitcoin = input.required<boolean>();
	public online_lightning = input.required<boolean>();
	public online_mint = input.required<boolean>();
	public syncing_bitcoin = input.required<boolean>();
	public syncing_lightning = input.required<boolean>();
	public block_count = input.required<number>();

	/* Outputs */
	public save = output<void>();
	public cancel = output<void>();
	public abort = output<void>();
}
