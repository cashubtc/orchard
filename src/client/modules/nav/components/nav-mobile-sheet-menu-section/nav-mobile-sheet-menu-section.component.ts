/* Core Dependencies */
import {ChangeDetectionStrategy, Component, Inject, signal, computed} from '@angular/core';
/* Vendor Dependencies */
import {MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';

@Component({
	selector: 'orc-nav-mobile-sheet-menu-section',
	standalone: false,
	templateUrl: './nav-mobile-sheet-menu-section.component.html',
	styleUrl: './nav-mobile-sheet-menu-section.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavMobileSheetMenuSectionComponent {
	public navigated_section = signal<string>('');
	public hovered = signal<string>('');

	public active_section = computed(() => {
		if (this.navigated_section() === '') return this.data.active_section;
		return this.navigated_section();
	});

	public bitcoin_status: GraphicStatusState;
	public lightning_status: GraphicStatusState;
	public mint_status: GraphicStatusState;

	constructor(
		@Inject(MAT_BOTTOM_SHEET_DATA)
		public data: {
			active_section: string;
			enabled_bitcoin: boolean;
			enabled_lightning: boolean;
			enabled_mint: boolean;
			enabled_ecash: boolean;
			online_bitcoin: boolean;
			online_lightning: boolean;
			online_mint: boolean;
			syncing_bitcoin: boolean;
			syncing_lightning: boolean;
		},
		private bottomSheetRef: MatBottomSheetRef<NavMobileSheetMenuSectionComponent>,
	) {
		this.bitcoin_status = this.deriveStatus(data.enabled_bitcoin, data.online_bitcoin, data.syncing_bitcoin);
		this.lightning_status = this.deriveStatus(data.enabled_lightning, data.online_lightning, data.syncing_lightning);
		this.mint_status = this.deriveStatus(data.enabled_mint, data.online_mint);
	}

	public onItemClick(section: string) {
		this.navigated_section.set(section);
		this.bottomSheetRef.dismiss();
	}

	private deriveStatus(enabled: boolean, online: boolean, syncing: boolean = false): GraphicStatusState {
		if (!enabled) return null;
		if (online === false) return 'inactive';
		if (syncing === true) return 'warning';
		if (online === true) return 'active';
		return 'loading';
	}
}
