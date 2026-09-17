/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup} from '@angular/forms';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormOnchainComponent} from './mint-subsection-config-form-onchain.component';

const buildFormGroup = (confirmations: number | null = null): FormGroup =>
	new FormGroup({
		sat: new FormGroup({
			onchain: new FormGroup({
				min_amount: new FormControl(0),
				max_amount: new FormControl(0),
				confirmations: new FormControl({value: confirmations, disabled: true}),
			}),
		}),
	});

describe('MintSubsectionConfigFormOnchainComponent', () => {
	let component: MintSubsectionConfigFormOnchainComponent;
	let fixture: ComponentFixture<MintSubsectionConfigFormOnchainComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormOnchainComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('method', 'onchain');
		fixture.componentRef.setInput('form_group', buildFormGroup());
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('quotes', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should project the shared limits form', () => {
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-config-form-method')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-config-form-min')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-config-form-max')).toBeTruthy();
	});

	describe('confirmations select', () => {
		it('should render a disabled select with options 1 to 12 for nut4', () => {
			const select = fixture.nativeElement.querySelector('mat-select');
			expect(select).toBeTruthy();
			expect(select.getAttribute('aria-disabled')).toBe('true');
			expect(component.confirmation_options).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		});

		it('should render the configured confirmations from the form group', () => {
			fixture.componentRef.setInput('form_group', buildFormGroup(18));
			fixture.detectChanges();

			expect(component.form_onchain().get('confirmations')?.value).toBe(18);
			expect(component.form_onchain().get('confirmations')?.disabled).toBeTrue();
		});

		it('should not render the select for nut5', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
		});
	});
});
