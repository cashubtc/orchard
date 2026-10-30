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
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {OrcEcashSubsectionWalletModule} from '@client/modules/ecash/modules/ecash-subsection-wallet/ecash-subsection-wallet.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashGeneralBackupComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-backup/ecash-general-backup.component';
import {EcashGeneralIssueComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-issue/ecash-general-issue.component';
import {EcashGeneralMintAddComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-mint-add/ecash-general-mint-add.component';
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
	const operation = new EcashOperation({
		id: 'op-1',
		mint_id: 'mint-1',
		type: WalletOperationType.Issue,
		state: WalletOperationState.Finalized,
		unit: 'sat',
		amount: 2100,
		created_at: 0,
		updated_at: 0,
	});
	const ecash_service = {
		loadBalances: jasmine.createSpy('loadBalances').and.returnValue(of(balances)),
		loadMints: jasmine.createSpy('loadMints').and.returnValue(of(mints)),
		loadMintStatuses: jasmine.createSpy('loadMintStatuses').and.returnValue(of([])),
		getOperationsData: jasmine.createSpy('getOperationsData').and.returnValue(of({operations: [operation], count: 1})),
		clearBalancesCache: jasmine.createSpy('clearBalancesCache'),
		clearMintsCache: jasmine.createSpy('clearMintsCache'),
		loadSeed: jasmine.createSpy('loadSeed'),
	};
	const reserves = new MintReserves({liabilities: [{unit: 'sat', amount: 2100}], sources: [], reserves: 50_000, partial: false});
	const mint_service = {
		clearSolvencyCache: jasmine.createSpy('clearSolvencyCache'),
		loadMintReserves: jasmine.createSpy('loadMintReserves').and.returnValue(of(reserves)),
	};
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
		ecash_service.loadMintStatuses.and.returnValue(of([]));
		ecash_service.loadSeed.and.returnValue(of(new EcashSeed({created_at: 1, backed_up_at: null})));
	});

	it('should create', async () => {
		await create();
		expect(component).toBeTruthy();
	});

	it('stacks the cards in one column off desktop, and in two independent columns on desktop', async () => {
		await create();
		const selector = 'orc-ecash-general-balance, orc-ecash-general-actions, orc-ecash-general-mints, orc-ecash-general-activity';
		const cards = (root: Element) =>
			Array.from(root.querySelectorAll(selector), (card) => card.tagName.toLowerCase().replace('orc-ecash-general-', ''));

		component.device_type.set('mobile');
		fixture.detectChanges();
		expect(cards(fixture.nativeElement)).toEqual(['balance', 'actions', 'mints', 'activity']);

		component.device_type.set('desktop');
		fixture.detectChanges();
		expect(Array.from(fixture.nativeElement.querySelectorAll('.ecash-wallet-column'), cards)).toEqual([
			['balance', 'mints'],
			['actions', 'activity'],
		]);
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

	it('loads the latest operations for the activity summary', async () => {
		await create();
		expect(ecash_service.getOperationsData).toHaveBeenCalledWith({page: 0, page_size: 8});
		expect(component.operations()).toEqual([operation]);
		expect(component.loading_operations()).toBeFalse();
	});

	it("loads the Orchard mint's reserves for any user", async () => {
		await create();
		expect(component.mint_reserves()).toEqual(reserves);
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

	it('opens the issue panel on the Orchard mint, and refreshes balances, reserves and activity once ecash is issued', async () => {
		role = UserRole.Admin;
		await create();
		ecash_service.loadBalances.calls.reset();
		ecash_service.getOperationsData.calls.reset();
		mint_service.loadMintReserves.calls.reset();
		form_panel_service.open.and.returnValue({afterClosed: () => of(operation)});

		component.onIssue();
		const [panel, {data}] = form_panel_service.open.calls.mostRecent().args;
		expect(panel).toBe(EcashGeneralIssueComponent);
		expect(data.mint).toBe(mints[0]);
		expect(data.reserves()).toBe(reserves);
		expect(data.status().state).toBe('disabled');
		expect(data.balances()).toEqual(balances);
		expect(data.unit).toBeNull();
		expect(component.selected_unit()).toBe('sat');
		expect(mint_service.clearSolvencyCache).toHaveBeenCalled();
		expect(ecash_service.clearBalancesCache).toHaveBeenCalled();
		expect(ecash_service.loadBalances).toHaveBeenCalled();
		expect(mint_service.loadMintReserves).toHaveBeenCalled();
		expect(ecash_service.getOperationsData).toHaveBeenCalled();
	});

	it('opens the add-mint panel with the wallet mints, refreshing mints and checking only the added mint once one is added', async () => {
		await create();
		ecash_service.loadMints.calls.reset();
		ecash_service.loadMintStatuses.calls.reset();
		form_panel_service.open.and.returnValue({afterClosed: () => of(undefined)});
		component.onAddMint();
		const [panel, {data}] = form_panel_service.open.calls.mostRecent().args;
		expect(panel).toBe(EcashGeneralMintAddComponent);
		expect(data.mints()).toEqual(mints);
		expect(ecash_service.loadMints).not.toHaveBeenCalled();

		const status = (mint_id: string) => new EcashMintStatus({mint_id, online: true, latency_ms: 5, error: null, checked_at: 0});
		component.mint_statuses.set([status('mint-0')]);
		ecash_service.loadMintStatuses.and.returnValue(of([status('mint-1')]));
		form_panel_service.open.and.returnValue({afterClosed: () => of(mints[0])});
		component.onAddMint();
		expect(ecash_service.clearMintsCache).toHaveBeenCalled();
		expect(ecash_service.loadMints).toHaveBeenCalled();
		expect(ecash_service.loadMintStatuses).toHaveBeenCalledOnceWith('mint-1');
		expect(component.mint_statuses().map((item) => item.mint_id)).toEqual(['mint-0', 'mint-1']);
	});

	it('reminds to back up only once the wallet holds ecash it never backed up', async () => {
		await create();
		expect(component.backup_due()).toBeTrue();
		component.balances.set([new EcashBalance({mint_id: 'mint-1', unit: 'sat', balance: 0})]);
		expect(component.backup_due()).toBeFalse();
		component.balances.set(balances);
		component.seed.set(new EcashSeed({created_at: 1, backed_up_at: 2}));
		expect(component.backup_due()).toBeFalse();
	});

	it('opens the backup panel with the seed and mints, and drops the reminder once backed up', async () => {
		await create();
		form_panel_service.open.and.returnValue({afterClosed: () => of(undefined)});
		component.onBackup();
		const [panel, {data}] = form_panel_service.open.calls.mostRecent().args;
		expect(panel).toBe(EcashGeneralBackupComponent);
		expect(data).toEqual({seed: component.seed(), mints});
		expect(component.backup_due()).toBeTrue();

		form_panel_service.open.and.returnValue({afterClosed: () => of(new EcashSeed({created_at: 1, backed_up_at: 2}))});
		component.onBackup();
		expect(component.seed()?.backed_up_at).toBe(2);
		expect(component.backup_due()).toBeFalse();
	});

	it('opens the issue panel in the unit the balance card has selected', async () => {
		role = UserRole.Admin;
		await create();
		form_panel_service.open.and.returnValue({afterClosed: () => of(undefined)});

		component.onSelectUnit('usd');
		component.onIssue();
		expect(form_panel_service.open.calls.mostRecent().args[1].data.unit).toBe('usd');
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
