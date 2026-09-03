/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup} from '@angular/forms';
/* Application Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormMethodComponent} from './mint-subsection-config-form-method.component';

const makeMintQuote = (overrides: Partial<MintMintQuote>): MintMintQuote =>
	new MintMintQuote({
		id: 'quote',
		unit: 'ora',
		state: 'PAID',
		created_time: 1,
		amount_paid: 0,
		amount_issued: 0,
		payment_method: 'branch',
		...overrides,
	} as any);

const makeMeltQuote = (overrides: Partial<MintMeltQuote>): MintMeltQuote =>
	new MintMeltQuote({
		id: 'quote',
		unit: 'ora',
		state: 'PAID',
		created_time: 1,
		amount: 0,
		payment_method: 'branch',
		...overrides,
	} as any);

const buildFormGroup = (): FormGroup =>
	new FormGroup({
		ora: new FormGroup({
			branch: new FormGroup({
				min_amount: new FormControl(1),
				max_amount: new FormControl(500000),
			}),
		}),
	});

describe('MintSubsectionConfigFormMethodComponent', () => {
	let component: MintSubsectionConfigFormMethodComponent;
	let fixture: ComponentFixture<MintSubsectionConfigFormMethodComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormMethodComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('unit', 'ora');
		fixture.componentRef.setInput('method', 'branch');
		fixture.componentRef.setInput('form_group', buildFormGroup());
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('quotes', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should resolve the form group for a custom unit and method', () => {
		expect(component.form_method().get('min_amount')?.value).toBe(1);
		expect(component.form_method().get('max_amount')?.value).toBe(500000);
	});

	it('should render only the min and max controls', () => {
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-config-form-min')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-config-form-max')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('mat-select')).toBeNull();
		expect(fixture.nativeElement.querySelector('mat-slide-toggle')).toBeNull();
	});

	describe('valid_quotes', () => {
		it('should accept PAID and ISSUED mint quotes and reject UNPAID and PENDING', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'paid', state: 'PAID' as any}),
				makeMintQuote({id: 'issued', state: 'ISSUED' as any}),
				makeMintQuote({id: 'unpaid', state: 'UNPAID' as any}),
				makeMintQuote({id: 'pending', state: 'PENDING' as any}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['paid', 'issued']);
		});

		it('should reject mint quotes for other units', () => {
			fixture.componentRef.setInput('quotes', [makeMintQuote({id: 'ora'}), makeMintQuote({id: 'sat', unit: 'sat'})]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['ora']);
		});

		it('should sort mint quotes by created time ascending', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'newest', created_time: 3}),
				makeMintQuote({id: 'oldest', created_time: 1}),
				makeMintQuote({id: 'middle', created_time: 2}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['oldest', 'middle', 'newest']);
		});

		it('should only accept PAID melt quotes for nut5', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			fixture.componentRef.setInput('quotes', [
				makeMeltQuote({id: 'paid', state: 'PAID' as any}),
				makeMeltQuote({id: 'unpaid', state: 'UNPAID' as any}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['paid']);
		});
	});

	describe('stats', () => {
		it('should chart the paid amount of mint quotes, not the issued amount', () => {
			fixture.componentRef.setInput('quotes', [makeMintQuote({id: 'partial', amount_paid: 3776, amount_issued: 3000})]);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();
			expect(component.stat_amounts()).toEqual([{created_time: 1, amount: 3776}]);
			expect(component.stats().max).toBe(3776);
		});

		it('should chart the amount of melt quotes for nut5', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			fixture.componentRef.setInput('quotes', [makeMeltQuote({id: 'melted', amount: 500})]);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();
			expect(component.stat_amounts()).toEqual([{created_time: 1, amount: 500}]);
		});
	});

	describe('actions up', () => {
		it('should emit update with the method context', () => {
			const emitted: any[] = [];
			component.update.subscribe((event) => emitted.push(event));
			component.onUpdate('min_amount');
			expect(emitted.length).toBe(1);
			expect(emitted[0].nut).toBe('nut4');
			expect(emitted[0].unit).toBe('ora');
			expect(emitted[0].method).toBe('branch');
			expect(emitted[0].control_name).toBe('min_amount');
		});

		it('should emit cancel with the method context', () => {
			const emitted: any[] = [];
			component.cancel.subscribe((event) => emitted.push(event));
			component.onCancel('max_amount');
			expect(emitted.length).toBe(1);
			expect(emitted[0].control_name).toBe('max_amount');
		});
	});
});
