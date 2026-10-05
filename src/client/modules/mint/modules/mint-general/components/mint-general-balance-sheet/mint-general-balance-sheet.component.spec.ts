/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Shared Dependencies */
import {MintReserveSource, MintReserveStatus, OrchardMintReserveSource, OrchardMintReserves} from '@shared/generated.types';
/* Local Dependencies */
import {MintGeneralBalanceSheetComponent} from './mint-general-balance-sheet.component';

/** Builds a mock MintKeyset with overridable fields. */
function buildKeyset(overrides: Partial<MintKeyset> = {}): MintKeyset {
	return {
		id: 'ks_001',
		active: true,
		derivation_path: "m/0'/0'/0'",
		derivation_path_index: 0,
		input_fee_ppk: 0,
		unit: 'sat',
		valid_from: null,
		valid_to: null,
		final_expiry: null,
		fees_paid: 0,
		amounts: [],
		...overrides,
	} as MintKeyset;
}

/** Builds a mock reserve source with overridable fields. */
function buildSource(overrides: Partial<OrchardMintReserveSource> = {}): OrchardMintReserveSource {
	return {source: MintReserveSource.LightningActive, status: MintReserveStatus.Available, amount: 0, selected: true, ...overrides};
}

/** Builds mock reserves with overridable fields. */
function buildReserves(overrides: Partial<OrchardMintReserves> = {}): MintReserves {
	return new MintReserves({liabilities: [], sources: [], reserves: null, partial: false, ...overrides});
}

describe('MintGeneralBalanceSheetComponent', () => {
	let component: MintGeneralBalanceSheetComponent;
	let fixture: ComponentFixture<MintGeneralBalanceSheetComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintGeneralBalanceSheetComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('balances', []);
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('reserves', null);
		fixture.componentRef.setInput('reserves_loading', false);
		fixture.componentRef.setInput('bitcoin_oracle_enabled', false);
		fixture.componentRef.setInput('bitcoin_oracle_price', null);
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('asset balances', () => {
		it('should back a sat row with the reserves', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'sat'})]);
			fixture.componentRef.setInput('reserves', buildReserves({reserves: 50000}));
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBe(50000);
			expect(component.rows()[0].is_bitcoin).toBe(true);
		});

		it('should show how many times the reserves cover the liabilities', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'sat'})]);
			fixture.componentRef.setInput('balances', [new MintBalance({keyset: 'ks_001', balance: 12000})]);
			fixture.componentRef.setInput('reserves', buildReserves({reserves: 50000}));
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].solvency).toBe(4.2);
		});

		it('should not back a custom unit row with the reserves', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'ora'})]);
			fixture.componentRef.setInput('reserves', buildReserves({reserves: 50000}));
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBeNull();
			expect(component.rows()[0].is_bitcoin).toBe(false);
		});

		it('should not back a fiat row with the reserves', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'usd'})]);
			fixture.componentRef.setInput('reserves', buildReserves({reserves: 50000}));
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBeNull();
		});
	});

	describe('reserve sources', () => {
		it('should caption every channel as lightning local capacity in lightning custody', () => {
			fixture.componentRef.setInput(
				'reserves',
				buildReserves({
					sources: [buildSource(), buildSource({source: MintReserveSource.LightningInactive})],
				}),
			);
			expect(component.reserves_label()).toBe('Lightning local capacity');
			expect(component.reserves_custody()).toBe('lightning');
		});

		it('should show hot custody once an on-chain wallet counts', () => {
			fixture.componentRef.setInput(
				'reserves',
				buildReserves({sources: [buildSource(), buildSource({source: MintReserveSource.MintWallet})]}),
			);
			expect(component.reserves_label()).toBe('2 asset sources');
			expect(component.reserves_custody()).toBe('hot');
		});

		it("should explain missing reserves with a selected source's own error, once per error", () => {
			const failed = {status: MintReserveStatus.Unavailable, error_code: 30002, error_details: 'lightning node unreachable'};
			fixture.componentRef.setInput(
				'reserves',
				buildReserves({
					sources: [buildSource(failed), buildSource({...failed, source: MintReserveSource.LightningInactive})],
				}),
			);
			expect(component.reserves_failures()).toEqual([
				{code: 30002, message: 'lightning node unreachable', details: 'lightning node unreachable'},
			]);
		});

		it('should point at lightning configuration only when a selected channel source is not set up', () => {
			const unconfigured = {status: MintReserveStatus.Unconfigured};
			fixture.componentRef.setInput('reserves', buildReserves({sources: [buildSource(unconfigured)]}));
			expect(component.reserves()?.lightning_unconfigured).toBe(true);

			fixture.componentRef.setInput(
				'reserves',
				buildReserves({
					sources: [buildSource({...unconfigured, selected: false}), buildSource({source: MintReserveSource.MintWallet})],
				}),
			);
			expect(component.reserves()?.lightning_unconfigured).toBe(false);
		});
	});

	describe('reserve source menu', () => {
		let emitted: MintReserveSource[][];

		beforeEach(() => {
			emitted = [];
			component.reserve_sources_change.subscribe((sources) => emitted.push(sources));
			fixture.componentRef.setInput(
				'reserves',
				buildReserves({
					sources: [
						buildSource({amount: 1000}),
						buildSource({source: MintReserveSource.LightningInactive, amount: 200}),
						buildSource({source: MintReserveSource.MintWallet, amount: 30, selected: false}),
					],
				}),
			);
			component.onReserveMenuOpened();
		});

		it('should draft from the saved selection and total the drafted sources', () => {
			expect(component.draft_sources()).toEqual([MintReserveSource.LightningActive, MintReserveSource.LightningInactive]);
			component.toggleReserveSource(MintReserveSource.MintWallet);
			expect(component.draft_reserves()).toBe(1230);
		});

		it('should let only sources this mint has set up be ticked', () => {
			const statuses = [
				MintReserveStatus.Available,
				MintReserveStatus.Unavailable,
				MintReserveStatus.Unconfigured,
				MintReserveStatus.Unsupported,
			];
			const reserves = buildReserves({sources: statuses.map((status) => buildSource({status}))});
			expect(reserves.sources.map((source) => source.readable)).toEqual([true, true, false, false]);
		});

		it('should not save when the menu closes unchanged', () => {
			component.toggleReserveSource(MintReserveSource.LightningActive);
			component.toggleReserveSource(MintReserveSource.LightningActive);
			component.onReserveMenuClosed();
			expect(emitted).toEqual([]);
		});

		it('should save the changed selection in source order when the menu closes', () => {
			component.toggleReserveSource(MintReserveSource.MintWallet);
			component.toggleReserveSource(MintReserveSource.LightningActive);
			component.onReserveMenuClosed();
			expect(emitted).toEqual([[MintReserveSource.LightningInactive, MintReserveSource.MintWallet]]);
		});

		it('should save an empty selection', () => {
			component.toggleReserveSource(MintReserveSource.LightningActive);
			component.toggleReserveSource(MintReserveSource.LightningInactive);
			component.onReserveMenuClosed();
			expect(emitted).toEqual([[]]);
		});
	});
});
