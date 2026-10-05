/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, effect, signal, viewChild, inject} from '@angular/core';
/* Vendor Dependencies */
import {MatMenuTrigger} from '@angular/material/menu';
import {MatBottomSheet} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintActivitySummary} from '@client/modules/mint/classes/mint-activity-summary.class';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {OrchardError} from '@client/modules/error/types/error.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {PublicUrl} from '@client/modules/public/classes/public-url.class';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';
/* Shared Dependencies */
import {MintActivityPeriod} from '@shared/generated.types';
/* Components */
import {NavMobileSheetMenuSubsectionComponent} from '@client/modules/nav/components/nav-mobile-sheet-menu-subsection/nav-mobile-sheet-menu-subsection.component';

type Liabilities = {
	unit: string;
	amount: number;
};

@Component({
	selector: 'orc-index-subsection-dashboard-mint-enabled',
	standalone: false,
	templateUrl: './index-subsection-dashboard-mint-enabled.component.html',
	styleUrl: './index-subsection-dashboard-mint-enabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSubsectionDashboardMintEnabledComponent {
	private bottomSheet = inject(MatBottomSheet);
	private navService = inject(NavService);

	public loading = input.required<boolean>();
	public loading_icon = input.required<boolean>();
	public info = input.required<MintInfo | null>();
	public keysets = input.required<MintKeyset[]>();
	public balances = input.required<MintBalance[]>();
	public icon_data = input.required<string | null>();
	public bitcoin_oracle_enabled = input.required<boolean>();
	public bitcoin_oracle_price = input.required<BitcoinOraclePrice | null>();
	public reserves = input.required<MintReserves | null>();
	public reserves_errors = input.required<OrchardError[]>();
	public reserves_loading = input.required<boolean>();
	public mint_errors = input.required<OrchardError[]>();
	public device_type = input.required<DeviceType>();
	public connections = input<PublicUrl[]>([]);
	public activity_summary = input.required<MintActivitySummary | null>();
	public loading_activity = input<boolean>(false);
	public error_activity = input<boolean>(false);

	private menu_trigger = viewChild(MatMenuTrigger);

	public navigate = output<string>();
	public period_change = output<MintActivityPeriod>();

	public items = signal<NavSecondaryItem[]>([]);
	public liabilities = signal<Liabilities[] | null>(null);

	constructor() {
		effect(() => {
			if (!this.loading()) return;
			this.init();
		});
	}

	ngOnInit(): void {
		const items = this.navService.getMenuItems('mint');
		this.items.set(items);
	}

	private init(): void {
		this.liabilities.set(this.getLiabilities());
	}

	private getLiabilities(): Liabilities[] | null {
		const balances = this.balances();
		const keysets = this.keysets();
		if (!balances || !keysets) return null;

		const grouped_liabilities = balances.reduce(
			(acc, balance) => {
				const keyset = keysets.find((k) => k.id === balance.keyset);
				if (!keyset) return acc;
				if (!acc[keyset.unit]) {
					acc[keyset.unit] = {
						unit: keyset.unit,
						amount: 0,
					};
				}
				acc[keyset.unit].amount += balance.balance;
				return acc;
			},
			{} as Record<string, Liabilities>,
		);

		return Object.values(grouped_liabilities);
	}

	public onMenuClick() {
		this.device_type() === 'mobile' ? this.openMobileMenu() : this.openDesktopMenu();
	}

	private openDesktopMenu(): void {
		this.menu_trigger()?.openMenu();
	}

	private openMobileMenu(): void {
		this.bottomSheet.open(NavMobileSheetMenuSubsectionComponent, {
			autoFocus: false,
			data: {
				items: this.items(),
				active_sub_section: '',
				enabled: true,
				online: this.mint_errors().length === 0,
				syncing: false,
				icon: 'bitcoin',
				name: 'Bitcoin',
			},
		});
	}
}
