import {ChangeDetectionStrategy, Component, input} from '@angular/core';

@Component({
	selector: 'orc-nav-primary-items',
	standalone: false,
	templateUrl: './nav-primary-items.component.html',
	styleUrl: './nav-primary-items.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavPrimaryItemsComponent {
	public active_section = input.required<string>();
	public enabled_bitcoin = input.required<boolean>();
	public enabled_lightning = input.required<boolean>();
	public enabled_mint = input.required<boolean>();
	public enabled_ecash = input.required<boolean>();
	public online_bitcoin = input.required<boolean>();
	public online_lightning = input.required<boolean>();
	public online_mint = input.required<boolean>();
	public syncing_bitcoin = input.required<boolean>();
	public syncing_lightning = input.required<boolean>();
}
