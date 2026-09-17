/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormBolt11Component} from './mint-subsection-config-form-bolt11.component';

const buildFormGroup = (): FormGroup =>
	new FormGroup({
		sat: new FormGroup({
			bolt11: new FormGroup({
				min_amount: new FormControl(0, [Validators.required]),
				max_amount: new FormControl(100, [Validators.required]),
				description: new FormControl(false),
				amountless: new FormControl(false),
			}),
		}),
	});

describe('MintSubsectionConfigFormBolt11Component', () => {
	let component: MintSubsectionConfigFormBolt11Component;
	let fixture: ComponentFixture<MintSubsectionConfigFormBolt11Component>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormBolt11Component);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('method', 'bolt11');
		fixture.componentRef.setInput('form_group', buildFormGroup());
		fixture.componentRef.setInput('form_status', false);
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('loading', false);
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

	describe('toggle', () => {
		it('should bind the description control for nut4', () => {
			expect(component.toggle_control()).toBe('description');
			expect(component.toggle_control_name()).toBe('Description');
		});

		it('should bind the amountless control for nut5', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			expect(component.toggle_control()).toBe('amountless');
			expect(component.toggle_control_name()).toBe('Amountless');
		});

		it('should write the toggled value and emit update with the method context', () => {
			const emitted: any[] = [];
			component.update.subscribe((event) => emitted.push(event));

			component.onToggle({checked: true} as any);

			expect(component.form_bolt11().get('description')?.value).toBeTrue();
			expect(emitted.length).toBe(1);
			expect(emitted[0].nut).toBe('nut4');
			expect(emitted[0].unit).toBe('sat');
			expect(emitted[0].method).toBe('bolt11');
			expect(emitted[0].control_name).toBe('description');
		});

		it('should disable the toggle when the form status turns on', () => {
			fixture.componentRef.setInput('form_status', true);
			fixture.detectChanges();
			expect(component.form_bolt11().get('description')?.disabled).toBeTrue();
		});
	});
});
