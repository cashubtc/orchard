/* Core Dependencies */
import {Injectable} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
/* Vendor Dependencies */
import {MatIconRegistry} from '@angular/material/icon';

@Injectable({
	providedIn: 'root',
})
export class GraphicService {
	constructor(
		private matIconRegistry: MatIconRegistry,
		private domSanitizer: DomSanitizer,
	) {}

	public init(): void {
		this.matIconRegistry.setDefaultFontSetClass('mat-symbol');

		this.matIconRegistry
			.addSvgIcon('bitcoin', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/bitcoin.svg'))
			.addSvgIcon('bitcoin_outline', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/bitcoin-outline.svg'))
			.addSvgIcon('tor', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/tor.svg'))
			.addSvgIcon('nostr', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/nostr.svg'))
			.addSvgIcon('x', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/x.svg'))
			.addSvgIcon('minting_disabled_outline', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/minting-disabled-outline.svg'))
			.addSvgIcon('melting_disabled_outline', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/melting-disabled-outline.svg'))
			.addSvgIcon('double_bolt', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/double-bolt.svg'))
			.addSvgIcon('do_not_disturb_on', this.domSanitizer.bypassSecurityTrustResourceUrl('icon/do-not-disturb-on.svg'));
	}
}
