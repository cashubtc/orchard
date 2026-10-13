/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Shared Dependencies */
import {MintReserveSource, MintReserveStatus} from '@shared/generated.types';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralSolvencyComponent} from './ecash-general-solvency.component';

describe('EcashGeneralSolvencyComponent', () => {
	let component: EcashGeneralSolvencyComponent;
	let fixture: ComponentFixture<EcashGeneralSolvencyComponent>;

	const reserves = (reserves_sats: number | null, liabilities: number) =>
		new MintReserves({
			liabilities: [{unit: 'sat', amount: liabilities}],
			sources: [
				{
					source: MintReserveSource.LightningActive,
					status: reserves_sats === null ? MintReserveStatus.Unavailable : MintReserveStatus.Available,
					amount: reserves_sats,
					selected: true,
				},
			],
			reserves: reserves_sats,
			partial: false,
		});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralSolvencyComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('reserves', reserves(10_005_068, 3606));
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('wallet_amount', 601);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("weighs the mint's reserves against the unit's liabilities", () => {
		expect(component.verdict()).toBe('backed');
		expect(component.coverage()).toBe(2775);
		expect(component.liabilities_sats()).toBe(3606);
		expect(fixture.nativeElement.textContent).toContain('Fully backed');
		expect(fixture.nativeElement.textContent).toContain('is in your wallet');
	});

	it('weighs an issue against the balance sheet before and after it', () => {
		fixture.componentRef.setInput('reserves', reserves(10_000, 4000));
		fixture.componentRef.setInput('issuing', 1000);
		fixture.detectChanges();
		expect(component.liabilities()).toBe(5000);
		expect(component.coverage_before()).toBe(2.5);
		expect(component.coverage()).toBe(2);
		expect(fixture.nativeElement.textContent).toContain('Still fully backed');
		expect(fixture.nativeElement.textContent).toContain('from this issue');

		fixture.componentRef.setInput('issuing', 7000);
		expect(component.verdict()).toBe('short');
		expect(component.verdict_label()).toBe('Not fully backed after this');
	});

	it('shows the change captions only once an amount is entered', () => {
		fixture.componentRef.setInput('issuing', 0);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('No change');
		expect(fixture.nativeElement.textContent).not.toContain('from this issue');

		fixture.componentRef.setInput('issuing', 1000);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('No change');
		expect(fixture.nativeElement.textContent).toContain('from this issue');
	});

	it('only blames an issue for a shortfall it causes', () => {
		fixture.componentRef.setInput('reserves', reserves(1000, 2000));
		fixture.componentRef.setInput('issuing', 0);
		expect(component.verdict_label()).toBe('Not fully backed');

		fixture.componentRef.setInput('issuing', 500);
		expect(component.verdict_label()).toBe('Currently not fully backed');
	});

	it('keeps the stacks closed, and unbuilt, until a collapsible balance sheet is opened', () => {
		fixture.componentRef.setInput('collapsible', true);
		fixture.detectChanges();
		expect(component.open()).toBeFalse();
		expect(fixture.nativeElement.querySelector('orc-graphic-coin-stack')).toBeNull();

		component.onToggle();
		fixture.detectChanges();
		expect(component.open()).toBeTrue();
		expect(fixture.nativeElement.querySelector('orc-graphic-coin-stack')).not.toBeNull();
	});

	it('tells assistive tech whether the collapsible balance sheet is open', () => {
		fixture.componentRef.setInput('collapsible', true);
		fixture.detectChanges();
		const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.ecash-solvency-toggle');
		expect(toggle.getAttribute('aria-expanded')).toBe('false');

		toggle.click();
		fixture.detectChanges();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
	});

	it('weighs an issue against assets that could not be read', () => {
		fixture.componentRef.setInput('reserves', reserves(null, 4000));
		fixture.componentRef.setInput('issuing', 1000);
		fixture.detectChanges();
		expect(component.verdict_label()).toBe('Assets unavailable');
		expect(fixture.nativeElement.textContent).toContain("Couldn't be read");
		expect(fixture.nativeElement.textContent).toContain('from this issue');
	});

	it('says when reserves fall short or cannot be read', () => {
		fixture.componentRef.setInput('reserves', reserves(999, 1000));
		expect(component.coverage()).toBe(0.99);
		expect(component.verdict()).toBe('short');

		fixture.componentRef.setInput('reserves', reserves(null, 4000));
		fixture.detectChanges();
		expect(component.verdict()).toBe('unknown');
		expect(component.coverage()).toBeNull();
		expect(fixture.nativeElement.textContent).toContain("Couldn't be read");
	});

	it('tells no assets selected apart from assets that could not be read', () => {
		fixture.componentRef.setInput(
			'reserves',
			new MintReserves({liabilities: [{unit: 'sat', amount: 4000}], sources: [], reserves: null, partial: false}),
		);
		fixture.detectChanges();
		expect(component.verdict()).toBe('none');
		expect(component.verdict_label()).toBe('No assets selected');
		expect(fixture.nativeElement.textContent).not.toContain('No change');
	});
});
