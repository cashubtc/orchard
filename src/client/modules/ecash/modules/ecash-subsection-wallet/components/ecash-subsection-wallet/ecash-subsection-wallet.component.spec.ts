/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {of} from 'rxjs';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {User} from '@client/modules/crew/classes/user.class';
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
/* Native Dependencies */
import {OrcEcashSubsectionWalletModule} from '@client/modules/ecash/modules/ecash-subsection-wallet/ecash-subsection-wallet.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashGeneralIssueComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-issue/ecash-general-issue.component';
/* Shared Dependencies */
import {UserRole, WalletOperationState, WalletOperationType} from '@shared/generated.types';
/* Local Dependencies */
import {EcashSubsectionWalletComponent} from './ecash-subsection-wallet.component';

describe('EcashSubsectionWalletComponent', () => {
	let component: EcashSubsectionWalletComponent;
	let fixture: ComponentFixture<EcashSubsectionWalletComponent>;
	let oracle_enabled: boolean;
	let role: UserRole;

	const balances = [new EcashBalance({mint_id: 'mint-1', unit: 'sat', balance: 2100})];
	const mints = [
		new EcashMint({
			id: 'mint-1',
			urls: ['https://mint.orchard.example'],
			is_orchard: true,
			created_at: 0,
			info: {
				name: 'Orchard Mint',
				nuts: {nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]}, nut5: {disabled: false, methods: []}},
			},
		}),
	];
	const ecash_service = {
		loadBalances: jasmine.createSpy('loadBalances').and.returnValue(of(balances)),
		loadMints: jasmine.createSpy('loadMints').and.returnValue(of(mints)),
		loadMintStatuses: jasmine.createSpy('loadMintStatuses').and.returnValue(of([])),
		clearBalancesCache: jasmine.createSpy('clearBalancesCache'),
	};
	const mint_service = {clearSolvencyCache: jasmine.createSpy('clearSolvencyCache')};
	const form_panel_service = {open: jasmine.createSpy('open')};
	const price = new BitcoinOraclePrice({date: 0, price: 100_000});
	const bitcoin_service = {loadBitcoinOraclePrice: jasmine.createSpy('loadBitcoinOraclePrice').and.returnValue(of(price))};

	const create = async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashSubsectionWalletModule],
			providers: [
				{provide: EcashService, useValue: ecash_service},
				{provide: MintService, useValue: mint_service},
				{provide: FormPanelService, useValue: form_panel_service},
				{provide: BitcoinService, useValue: bitcoin_service},
				{
					provide: CrewService,
					useValue: {user$: of(new User({id: 'user-1', name: 'satoshi', role, active: true, created_at: 0}))},
				},
				{
					provide: SettingAppService,
					useValue: {getSetting: jasmine.createSpy('getSetting').and.callFake(() => ({value: oracle_enabled}))},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashSubsectionWalletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	beforeEach(() => {
		oracle_enabled = false;
		role = UserRole.Reader;
		bitcoin_service.loadBitcoinOraclePrice.calls.reset();
	});

	it('should create', async () => {
		await create();
		expect(component).toBeTruthy();
	});

	it('loads the wallet balances', async () => {
		await create();
		expect(component.balances()).toEqual(balances);
		expect(component.loading_balances()).toBeFalse();
	});

	it('loads the wallet mints and their statuses', async () => {
		await create();
		expect(component.mints()).toEqual(mints);
		expect(component.loading_mints()).toBeFalse();
		expect(component.mint_statuses()).toEqual([]);
		expect(component.loading_mint_statuses()).toBeFalse();
	});

	it('hides issuing from non-admins', async () => {
		await create();
		expect(component.can_issue()).toBeFalse();
	});

	it('offers issuing to admins with the Orchard mint in their wallet', async () => {
		role = UserRole.Admin;
		await create();
		expect(component.can_issue()).toBeTrue();
		expect(component.issue_blocked()).toBeNull();
	});

	it('opens the issue panel on the Orchard mint, and refreshes balances once ecash is issued', async () => {
		role = UserRole.Admin;
		await create();
		ecash_service.loadBalances.calls.reset();
		const operation = new EcashOperation({
			id: 'op-1',
			mint_id: 'mint-1',
			type: WalletOperationType.Mint,
			state: WalletOperationState.Finalized,
			unit: 'sat',
			amount: 2100,
			created_at: 0,
			updated_at: 0,
		});
		form_panel_service.open.and.returnValue({afterClosed: () => of(operation)});

		component.onIssue();
		expect(form_panel_service.open).toHaveBeenCalledWith(EcashGeneralIssueComponent, {data: {mint: mints[0]}});
		expect(mint_service.clearSolvencyCache).toHaveBeenCalled();
		expect(ecash_service.clearBalancesCache).toHaveBeenCalled();
		expect(ecash_service.loadBalances).toHaveBeenCalled();
	});

	it('skips the oracle price while the oracle is disabled', async () => {
		await create();
		expect(bitcoin_service.loadBitcoinOraclePrice).not.toHaveBeenCalled();
	});

	it('loads the oracle price when the oracle is enabled', async () => {
		oracle_enabled = true;
		await create();
		expect(component.bitcoin_oracle_price()).toEqual(price);
	});
});
