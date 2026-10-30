/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {deviceTypeFromBreakpoints} from '@client/modules/layout/helpers/device.helpers';
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashGeneralIssueComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-issue/ecash-general-issue.component';
import {getMintStatusPill} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';
import {EcashGeneralMintAddComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-mint-add/ecash-general-mint-add.component';
import {EcashGeneralBackupComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-backup/ecash-general-backup.component';
import {
	EcashBackupPanelData,
	EcashIssuePanelData,
	EcashMintAddPanelData,
} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

const ACTIVITY_RECENT_COUNT = 8;

@Component({
	selector: 'orc-ecash-subsection-wallet',
	standalone: false,
	templateUrl: './ecash-subsection-wallet.component.html',
	styleUrl: './ecash-subsection-wallet.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashSubsectionWalletComponent implements OnInit, OnDestroy {
	private readonly ecashService = inject(EcashService);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly crewService = inject(CrewService);
	private readonly mintService = inject(MintService);
	private readonly formPanelService = inject(FormPanelService);
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly destroyRef = inject(DestroyRef);

	public readonly bitcoin_oracle_enabled: boolean = this.settingAppService.getSetting('bitcoin_oracle').value;

	public readonly balances = signal<EcashBalance[]>([]);
	public readonly mints = signal<EcashMint[]>([]);
	public readonly mint_statuses = signal<EcashMintStatus[]>([]);
	public readonly mint_reserves = signal<MintReserves | null>(null);
	public readonly operations = signal<EcashOperation[]>([]);
	public readonly seed = signal<EcashSeed | null>(null);
	public readonly selected_unit = signal<string | null>(null);
	public readonly bitcoin_oracle_price = signal<BitcoinOraclePrice | null>(null);
	public readonly is_admin = signal<boolean>(false);
	public readonly device_type = signal<DeviceType>('desktop');
	public readonly loading_balances = signal<boolean>(true);
	public readonly loading_mints = signal<boolean>(true);
	public readonly loading_mint_statuses = signal<boolean>(true);
	public readonly loading_operations = signal<boolean>(true);
	public readonly loading_seed = signal<boolean>(true);

	/** Ecash is only issued from the Orchard mint, by an admin */
	public readonly orchard_mint = computed(() => this.mints().find((mint) => mint.is_orchard) ?? null);
	public readonly can_issue = computed(() => this.is_admin() && this.orchard_mint() !== null);

	public readonly issue_blocked = computed(() => this.orchard_mint()?.issue_blocked ?? null);

	/** The wallet holds ecash and its recovery words were never written down */
	public readonly backup_due = computed(
		() => !this.loading_seed() && !this.seed()?.backed_up_at && this.balances().some((balance) => balance.balance > 0),
	);

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.subscriptions.add(this.getUserSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.loadBalances();
		this.loadMints();
		this.loadMintStatuses();
		this.loadOperations();
		this.loadSeed();
		if (this.bitcoin_oracle_enabled) this.loadBitcoinOraclePrice();
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	/** Tracks whether the current user is an admin */
	private getUserSubscription(): Subscription {
		return this.crewService.user$.subscribe((user) => this.is_admin.set(user?.is_admin ?? false));
	}

	/** Observes viewport breakpoints and updates the device type */
	private getBreakpointSubscription(): Subscription {
		return this.breakpointObserver
			.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
			.subscribe((result) => this.device_type.set(deviceTypeFromBreakpoints(result)));
	}

	/* *******************************************************
		Data
	******************************************************** */

	/** The wallet balance per mint and unit */
	private loadBalances(): void {
		this.ecashService
			.loadBalances()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (balances) => {
					this.balances.set(balances);
					this.loading_balances.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_balances.set(false);
				},
			});
	}

	/** The mints in the wallet */
	private loadMints(): void {
		this.ecashService
			.loadMints()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (mints) => {
					this.mints.set(mints);
					this.loading_mints.set(false);
					if (this.orchard_mint()) this.loadMintReserves();
				},
				error: (error) => {
					console.error(error);
					this.loading_mints.set(false);
				},
			});
	}

	/** Probes every mint, or just one and merges it in; a mint with no status yet shows as checking until this lands */
	private loadMintStatuses(mint_id: string | null = null): void {
		this.loading_mint_statuses.set(true);
		this.ecashService
			.loadMintStatuses(mint_id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (statuses) => {
					this.mint_statuses.update((current) =>
						mint_id === null ? statuses : [...current.filter((status) => status.mint_id !== mint_id), ...statuses],
					);
					this.loading_mint_statuses.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_mint_statuses.set(false);
				},
			});
	}

	/** The latest operations, for the activity summary */
	private loadOperations(): void {
		this.ecashService
			.getOperationsData({page: 0, page_size: ACTIVITY_RECENT_COUNT})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({operations}) => {
					this.operations.set(operations);
					this.loading_operations.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_operations.set(false);
				},
			});
	}

	/** Whether the wallet's recovery words were backed up; without it the reminder still shows once the wallet holds ecash */
	private loadSeed(): void {
		this.ecashService
			.loadSeed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (seed) => {
					this.seed.set(seed);
					this.loading_seed.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_seed.set(false);
				},
			});
	}

	/** The Orchard mint's balance sheet; its card shows no solvency if this fails */
	private loadMintReserves(): void {
		this.mintService
			.loadMintReserves()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (reserves) => this.mint_reserves.set(reserves),
				error: (error) => console.error(error),
			});
	}

	/** The latest oracle price, for the USD conversions */
	private loadBitcoinOraclePrice(): void {
		this.bitcoinService
			.loadBitcoinOraclePrice()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((price) => this.bitcoin_oracle_price.set(price));
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Shows the picked unit's balance, and opens forms in it */
	public onSelectUnit(unit: string): void {
		this.selected_unit.set(unit);
	}

	/** Opens the issue panel in the selected unit; an issued operation switches the balance to its unit and refreshes what it changed, activity included */
	public onIssue(): void {
		const mint = this.orchard_mint();
		if (!mint) return;
		const data: EcashIssuePanelData = {
			mint,
			reserves: this.mint_reserves,
			status: computed(() => getMintStatusPill(this.mint_statuses(), mint.id, this.loading_mint_statuses())),
			balances: computed(() => this.balances().filter((balance) => balance.mint_id === mint.id)),
			unit: this.selected_unit(),
		};
		this.formPanelService
			.open<EcashIssuePanelData, EcashOperation>(EcashGeneralIssueComponent, {data})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((operation) => {
				if (!operation) return;
				this.selected_unit.set(operation.unit.toLowerCase());
				this.mintService.clearSolvencyCache();
				this.ecashService.clearBalancesCache();
				this.loadBalances();
				this.loadMintReserves();
				this.loadOperations();
			});
	}

	/** Opens the add-mint panel; an added mint refreshes the mints and their statuses */
	public onAddMint(): void {
		const data: EcashMintAddPanelData = {mints: this.mints};
		this.formPanelService
			.open<EcashMintAddPanelData, EcashMint>(EcashGeneralMintAddComponent, {data})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((mint) => {
				if (!mint) return;
				this.ecashService.clearMintsCache();
				this.loadMints();
				this.loadMintStatuses(mint.id);
			});
	}

	/** Opens the backup panel; a confirmed backup hides the reminder */
	public onBackup(): void {
		const data: EcashBackupPanelData = {seed: this.seed(), mints: this.mints()};
		this.formPanelService
			.open<EcashBackupPanelData, EcashSeed>(EcashGeneralBackupComponent, {data})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((seed) => {
				if (seed) this.seed.set(seed);
			});
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
