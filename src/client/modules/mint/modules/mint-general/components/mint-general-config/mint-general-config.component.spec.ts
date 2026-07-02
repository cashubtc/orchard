/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
/* Native Dependencies */
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Shared Dependencies */
import {OrchardMintInfo, OrchardNuts} from '@shared/generated.types';
/* Local Dependencies */
import {MintGeneralConfigComponent} from './mint-general-config.component';

/** Builds a minimal OrchardNuts with overridable fields. */
function buildNuts(overrides: Partial<OrchardNuts> = {}): OrchardNuts {
	return {
		nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100000}]},
		nut5: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000}]},
		nut7: {supported: true},
		nut8: {supported: true},
		nut9: {supported: false},
		nut10: {supported: true},
		nut11: {supported: true},
		nut12: {supported: false},
		...overrides,
	};
}

/** Builds a mock MintInfo from partial overrides. */
function buildMockInfo(overrides: Partial<OrchardMintInfo> = {}): MintInfo {
	return new MintInfo({
		name: 'Test Mint',
		pubkey: 'abc123',
		version: '0.1.0',
		description: null,
		description_long: null,
		contact: null,
		icon_url: null,
		tos_url: null,
		urls: null,
		time: 1700000000,
		nuts: buildNuts(),
		...overrides,
	});
}

describe('MintGeneralConfigComponent', () => {
	let component: MintGeneralConfigComponent;
	let fixture: ComponentFixture<MintGeneralConfigComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintGeneralConfigComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('info', null);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('nuts', () => {
		it('should return empty array when info is null', () => {
			expect(component.nuts()).toEqual([]);
		});

		it('should map nut entries with their status', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const nuts = component.nuts();
			expect(nuts.length).toBeGreaterThan(0);

			const nut4 = nuts.find((n) => n.number === 4);
			expect(nut4).toBeDefined();
			expect(nut4!.status).toBe('active');
		});

		it('should mark nut4 inactive when disabled', () => {
			const info = buildMockInfo({nuts: buildNuts({nut4: {disabled: true, methods: []}})});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const nut4 = component.nuts().find((n) => n.number === 4);
			expect(nut4!.status).toBe('inactive');
		});

		it('should mark nut5 inactive when disabled', () => {
			const info = buildMockInfo({nuts: buildNuts({nut5: {disabled: true, methods: []}})});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const nut5 = component.nuts().find((n) => n.number === 5);
			expect(nut5!.status).toBe('inactive');
		});

		it('should mark supported nuts as enabled', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const nut7 = component.nuts().find((n) => n.number === 7);
			expect(nut7!.status).toBe('enabled');
		});

		it('should mark unsupported nuts as disabled', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const nut9 = component.nuts().find((n) => n.number === 9);
			expect(nut9!.status).toBe('disabled');
		});
	});

	describe('supported_methods', () => {
		it('should return empty array when info is null', () => {
			expect(component.supported_methods()).toEqual([]);
		});

		it('should dedupe methods shared by nut4 and nut5', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			expect(component.supported_methods()).toEqual(['bolt11']);
		});

		it('should include methods unique to either nut', () => {
			const info = buildMockInfo({
				nuts: buildNuts({
					nut4: {
						disabled: false,
						methods: [
							{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100000},
							{method: 'onchain', unit: 'sat', min_amount: 1000, max_amount: null},
						],
					},
					nut5: {disabled: false, methods: [{method: 'bolt12', unit: 'sat', min_amount: 1, max_amount: 50000}]},
				}),
			});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			expect(component.supported_methods()).toEqual(['bolt11', 'onchain', 'bolt12']);
		});
	});

	describe('onNutClick', () => {
		it('should navigate to the config page with the nut scroll target', () => {
			const router = TestBed.inject(Router);
			const navigate_spy = spyOn(router, 'navigate');

			component.onNutClick(4);

			expect(navigate_spy).toHaveBeenCalledWith(['mint', 'config'], {state: {scroll_to: 'nav4'}});
		});
	});

	describe('minting_limits', () => {
		it('should return empty array when info is null', () => {
			expect(component.minting_limits()).toEqual([]);
		});

		it('should map nut4 methods to MethodLimit rows', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const limits = component.minting_limits();
			expect(limits.length).toBe(1);
			expect(limits[0]).toEqual({method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100000});
		});

		it('should handle methods with null min/max amounts', () => {
			const info = buildMockInfo({
				nuts: buildNuts({nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]}}),
			});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const limits = component.minting_limits();
			expect(limits[0].min_amount).toBeNull();
			expect(limits[0].max_amount).toBeNull();
		});
	});

	describe('melting_limits', () => {
		it('should return empty array when info is null', () => {
			expect(component.melting_limits()).toEqual([]);
		});

		it('should map nut5 methods to MethodLimit rows', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const limits = component.melting_limits();
			expect(limits.length).toBe(1);
			expect(limits[0]).toEqual({method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000});
		});
	});

	describe('getTrackWidthPercent', () => {
		it('should return 100 for the largest max_amount in a unit', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const mint_limit = component.minting_limits()[0];
			expect(component.getTrackWidthPercent(mint_limit)).toBe(100);
		});

		it('should return proportional width for smaller max_amount', () => {
			fixture.componentRef.setInput('info', buildMockInfo());
			fixture.detectChanges();

			const melt_limit = component.melting_limits()[0];
			expect(component.getTrackWidthPercent(melt_limit)).toBe(50);
		});

		it('should return 100 when max_amount is null', () => {
			const info = buildMockInfo({
				nuts: buildNuts({
					nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: null}]},
				}),
			});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const mint_limit = component.minting_limits()[0];
			expect(component.getTrackWidthPercent(mint_limit)).toBe(100);
		});

		it('should return 100 for all limits when any limit in the unit has null max_amount', () => {
			const info = buildMockInfo({
				nuts: buildNuts({
					nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: null}]},
					nut5: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000}]},
				}),
			});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const melt_limit = component.melting_limits()[0];
			expect(component.getTrackWidthPercent(melt_limit)).toBe(100);
		});

		it('should clamp small percentages to a minimum of 5', () => {
			const info = buildMockInfo({
				nuts: buildNuts({
					nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 1000000}]},
					nut5: {disabled: false, methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 1}]},
				}),
			});
			fixture.componentRef.setInput('info', info);
			fixture.detectChanges();

			const melt_limit = component.melting_limits()[0];
			expect(component.getTrackWidthPercent(melt_limit)).toBe(5);
		});
	});
});
