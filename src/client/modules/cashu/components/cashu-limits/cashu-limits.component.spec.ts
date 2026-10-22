/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcCashuModule} from '@client/modules/cashu/cashu.module';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method, OrchardNuts} from '@shared/generated.types';
/* Local Dependencies */
import {CashuLimitsComponent} from './cashu-limits.component';

describe('CashuLimitsComponent', () => {
	let component: CashuLimitsComponent;
	let fixture: ComponentFixture<CashuLimitsComponent>;

	const nuts = (nut4: OrchardNut4Method[], nut5: OrchardNut5Method[]): OrchardNuts => ({
		nut4: {disabled: false, methods: nut4},
		nut5: {disabled: false, methods: nut5},
	});
	const setNuts = (value: OrchardNuts) => {
		fixture.componentRef.setInput('nuts', value);
		fixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcCashuModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(CashuLimitsComponent);
		component = fixture.componentInstance;
		setNuts(
			nuts(
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100000}],
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000}],
			),
		);
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('maps NUT-04 and NUT-05 methods to limit rows, keeping missing bounds null', () => {
		expect(component.minting_limits()).toEqual([{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100000}]);
		expect(component.melting_limits()).toEqual([{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000}]);
		setNuts(nuts([{method: 'bolt11', unit: 'sat'}], []));
		expect(component.minting_limits()).toEqual([{method: 'bolt11', unit: 'sat', min_amount: null, max_amount: null}]);
		expect(component.melting_limits()).toEqual([]);
	});

	it('scales each track against the largest max in its unit', () => {
		expect(component.getTrackWidthPercent(component.minting_limits()[0])).toBe(100);
		expect(component.getTrackWidthPercent(component.melting_limits()[0])).toBe(50);
	});

	it('fills every track in a unit when any of its limits is unbounded', () => {
		setNuts(
			nuts(
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: null}],
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 50000}],
			),
		);
		expect(component.getTrackWidthPercent(component.minting_limits()[0])).toBe(100);
		expect(component.getTrackWidthPercent(component.melting_limits()[0])).toBe(100);
	});

	it('keeps a tiny track visible at 5%', () => {
		setNuts(
			nuts(
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 1000000}],
				[{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 1}],
			),
		);
		expect(component.getTrackWidthPercent(component.melting_limits()[0])).toBe(5);
	});

	it('stacks the minting and melting columns when asked', () => {
		expect(fixture.nativeElement.classList).not.toContain('stacked');
		fixture.componentRef.setInput('stacked', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.classList).toContain('stacked');
	});
});
