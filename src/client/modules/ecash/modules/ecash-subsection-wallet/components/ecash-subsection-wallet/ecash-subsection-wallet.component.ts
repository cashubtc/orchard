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
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashGeneralIssueComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-issue/ecash-general-issue.component';

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
	public readonly bitcoin_oracle_price = signal<BitcoinOraclePrice | null>(null);
	public readonly is_admin = signal<boolean>(false);
	public readonly device_type = signal<DeviceType>('desktop');
	public readonly loading_balances = signal<boolean>(true);
	public readonly loading_mints = signal<boolean>(true);
	public readonly loading_mint_statuses = signal<boolean>(true);

	/** Ecash is only issued from the Orchard mint, by an admin */
	public readonly orchard_mint = computed(() => this.mints().find((mint) => mint.is_orchard) ?? null);
	public readonly can_issue = computed(() => this.is_admin() && this.orchard_mint() !== null);

	public readonly issue_blocked = computed(() => this.orchard_mint()?.issue_blocked ?? null);

	private subscriptions: Subscription = new Subscription();

	ngOnInit(): void {
		this.subscriptions.add(this.getUserSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.loadBalances();
		this.loadMints();
		this.loadMintStatuses();
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
				},
				error: (error) => {
					console.error(error);
					this.loading_mints.set(false);
				},
			});
	}

	/** Probes every mint; each row shows as checking until this lands */
	private loadMintStatuses(): void {
		this.ecashService
			.loadMintStatuses()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (statuses) => {
					this.mint_statuses.set(statuses);
					this.loading_mint_statuses.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_mint_statuses.set(false);
				},
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

	/** Opens the issue panel; an issued operation refreshes the balances it changed */
	public onIssue(): void {
		const mint = this.orchard_mint();
		if (!mint) return;
		this.formPanelService
			.open<unknown, EcashOperation>(EcashGeneralIssueComponent, {data: {mint}})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((operation) => {
				if (!operation) return;
				this.mintService.clearSolvencyCache();
				this.ecashService.clearBalancesCache();
				this.loadBalances();
			});
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
