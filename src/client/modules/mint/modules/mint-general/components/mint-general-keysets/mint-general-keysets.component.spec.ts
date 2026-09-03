/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
/* Local Dependencies */
import {MintGeneralKeysetsComponent} from './mint-general-keysets.component';

/** Builds a mock MintKeyset with overridable fields. */
function buildKeyset(overrides: Partial<MintKeyset> = {}): MintKeyset {
	return new MintKeyset({
		id: 'ks_001',
		active: true,
		derivation_path: "m/0'/0'/0'",
		derivation_path_index: 0,
		input_fee_ppk: 0,
		unit: 'sat',
		valid_from: null,
		valid_to: null,
		fees_paid: 0,
		amounts: null,
		...overrides,
	});
}

/** Builds a mock MintKeysetCount. */
function buildKeysetCount(overrides: Partial<MintKeysetCount> = {}): MintKeysetCount {
	return new MintKeysetCount({
		id: 'ks_001',
		proof_count: 50,
		promise_count: 100,
		...overrides,
	});
}

describe('MintGeneralKeysetsComponent', () => {
	let component: MintGeneralKeysetsComponent;
	let fixture: ComponentFixture<MintGeneralKeysetsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintGeneralKeysetsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('keysets_counts', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('active_count / inactive_count', () => {
		it('should return 0 for both when keysets are empty', () => {
			expect(component.active_count()).toBe(0);
			expect(component.inactive_count()).toBe(0);
		});

		it('should count active and inactive keysets', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', active: true}),
				buildKeyset({id: 'ks_002', active: true}),
				buildKeyset({id: 'ks_003', active: false}),
			]);
			fixture.detectChanges();

			expect(component.active_count()).toBe(2);
			expect(component.inactive_count()).toBe(1);
		});
	});

	describe('active_percentage', () => {
		it('should return 0 when no keysets exist (zero-division guard)', () => {
			expect(component.active_percentage()).toBe(0);
		});

		it('should return 100 when all keysets are active', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({id: 'ks_001', active: true})]);
			fixture.detectChanges();

			expect(component.active_percentage()).toBe(100);
		});

		it('should compute correct percentage for mixed keysets', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', active: true}),
				buildKeyset({id: 'ks_002', active: false}),
				buildKeyset({id: 'ks_003', active: false}),
				buildKeyset({id: 'ks_004', active: true}),
			]);
			fixture.detectChanges();

			expect(component.active_percentage()).toBe(50);
		});
	});

	describe('unique_units', () => {
		it('should return empty array when no keysets exist', () => {
			expect(component.unique_units()).toEqual([]);
		});

		it('should deduplicate units across keysets', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', unit: 'sat'}),
				buildKeyset({id: 'ks_002', unit: 'sat'}),
				buildKeyset({id: 'ks_003', unit: 'usd'}),
			]);
			fixture.detectChanges();

			const units = component.unique_units();
			expect(units.length).toBe(2);
			expect(units).toContain('sat');
			expect(units).toContain('usd');
		});
	});

	describe('active_keyset_ids', () => {
		it('should return empty set when no keysets exist', () => {
			expect(component.active_keyset_ids().size).toBe(0);
		});

		it('should contain only active keyset IDs', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', active: true}),
				buildKeyset({id: 'ks_002', active: false}),
				buildKeyset({id: 'ks_003', active: true}),
			]);
			fixture.detectChanges();

			const ids = component.active_keyset_ids();
			expect(ids.size).toBe(2);
			expect(ids.has('ks_001')).toBe(true);
			expect(ids.has('ks_002')).toBe(false);
			expect(ids.has('ks_003')).toBe(true);
		});
	});

	describe('total_promises / total_proofs', () => {
		it('should return 0 when no keyset counts exist', () => {
			expect(component.total_promises()).toBe(0);
			expect(component.total_proofs()).toBe(0);
		});

		it('should sum across all keyset counts', () => {
			fixture.componentRef.setInput('keysets_counts', [
				buildKeysetCount({id: 'ks_001', promise_count: 100, proof_count: 50}),
				buildKeysetCount({id: 'ks_002', promise_count: 200, proof_count: 75}),
			]);
			fixture.detectChanges();

			expect(component.total_promises()).toBe(300);
			expect(component.total_proofs()).toBe(125);
		});
	});

	describe('active_promises / active_proofs', () => {
		it('should return 0 when no keysets or counts exist', () => {
			expect(component.active_promises()).toBe(0);
			expect(component.active_proofs()).toBe(0);
		});

		it('should sum only counts for active keysets', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', active: true}),
				buildKeyset({id: 'ks_002', active: false}),
				buildKeyset({id: 'ks_003', active: true}),
			]);
			fixture.componentRef.setInput('keysets_counts', [
				buildKeysetCount({id: 'ks_001', promise_count: 100, proof_count: 50}),
				buildKeysetCount({id: 'ks_002', promise_count: 200, proof_count: 75}),
				buildKeysetCount({id: 'ks_003', promise_count: 50, proof_count: 25}),
			]);
			fixture.detectChanges();

			expect(component.active_promises()).toBe(150);
			expect(component.active_proofs()).toBe(75);
		});
	});

	describe('active_promises_percentage / active_proofs_percentage', () => {
		it('should return 0 when totals are zero (zero-division guard)', () => {
			expect(component.active_promises_percentage()).toBe(0);
			expect(component.active_proofs_percentage()).toBe(0);
		});

		it('should return 100 when all keysets are active', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({id: 'ks_001', active: true})]);
			fixture.componentRef.setInput('keysets_counts', [buildKeysetCount({id: 'ks_001', promise_count: 100, proof_count: 50})]);
			fixture.detectChanges();

			expect(component.active_promises_percentage()).toBe(100);
			expect(component.active_proofs_percentage()).toBe(100);
		});

		it('should compute correct percentages for mixed active/inactive', () => {
			fixture.componentRef.setInput('keysets', [
				buildKeyset({id: 'ks_001', active: true}),
				buildKeyset({id: 'ks_002', active: false}),
			]);
			fixture.componentRef.setInput('keysets_counts', [
				buildKeysetCount({id: 'ks_001', promise_count: 75, proof_count: 30}),
				buildKeysetCount({id: 'ks_002', promise_count: 25, proof_count: 70}),
			]);
			fixture.detectChanges();

			expect(component.active_promises_percentage()).toBe(75);
			expect(component.active_proofs_percentage()).toBe(30);
		});
	});
});
