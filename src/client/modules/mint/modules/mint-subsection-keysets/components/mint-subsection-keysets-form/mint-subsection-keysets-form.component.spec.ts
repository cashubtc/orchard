/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Native Dependencies */
import {OrcMintSubsectionKeysetsModule} from '@client/modules/mint/modules/mint-subsection-keysets/mint-subsection-keysets.module';
/* Local Dependencies */
import {MintSubsectionKeysetsFormComponent} from './mint-subsection-keysets-form.component';

describe('MintSubsectionKeysetsFormComponent', () => {
	let component: MintSubsectionKeysetsFormComponent;
	let fixture: ComponentFixture<MintSubsectionKeysetsFormComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionKeysetsModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionKeysetsFormComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('mint_type', 'cdk');
		fixture.componentRef.setInput(
			'form_group',
			new FormGroup({
				unit: new FormControl('sat', [Validators.required]),
				input_fee_ppk: new FormControl(0, [Validators.required]),
				max_order: new FormControl(0, [Validators.required]),
				default_amounts: new FormControl(true),
				amounts: new FormControl([1, 2, 4, 8]),
				final_expiry: new FormControl(null),
			}),
		);
		fixture.componentRef.setInput('unit_options', [{value: 'sat', label: 'sat'}]);
		fixture.componentRef.setInput('keyset_out', {unit: 'sat', derivation_path_index: 0, input_fee_ppk: 0});
		fixture.componentRef.setInput('keyset_out_balance', {balance: 0});
		fixture.componentRef.setInput('median_notes', 0);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('defaults the final expiry help panel to expanded', () => {
		expect(component.help_final_expiry()).toBe(true);
	});

	it('renders the Final Expiry datepicker field in the advanced section', () => {
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Final Expiry');
		expect(fixture.nativeElement.querySelector('mat-datepicker-toggle')).toBeTruthy();
	});
});
