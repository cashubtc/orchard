/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
/* Native Dependencies */
import {PublicExitWarningComponent} from '@client/modules/public/components/public-exit-warning/public-exit-warning.component';

@Component({
	selector: 'orc-public-docs-link-card',
	standalone: false,
	templateUrl: './public-docs-link-card.component.html',
	styleUrl: './public-docs-link-card.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicDocsLinkCardComponent {
	private readonly dialog = inject(MatDialog); // Opens the safe external-link warning dialog.

	public readonly docs_link = input<string>(''); // Official Orchard docs URL; used when router_link is not set.
	public readonly router_link = input<string | null>(null); // Internal route for an in-app CTA; renders a routerLink button instead of the docs dialog.
	public readonly link_title = input.required<string>(); // Short label shown on the card's action button.

	/**
	 * Opens the safe-exit warning dialog for the projected documentation link.
	 *
	 * @returns {void} No return value.
	 */
	public onDocsLink(): void {
		this.dialog.open(PublicExitWarningComponent, {data: {link: this.docs_link()}});
	}
}
