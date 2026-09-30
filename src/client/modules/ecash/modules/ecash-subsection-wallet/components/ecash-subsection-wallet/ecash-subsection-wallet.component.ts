import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-ecash-subsection-wallet',
	standalone: false,
	templateUrl: './ecash-subsection-wallet.component.html',
	styleUrl: './ecash-subsection-wallet.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashSubsectionWalletComponent {}
