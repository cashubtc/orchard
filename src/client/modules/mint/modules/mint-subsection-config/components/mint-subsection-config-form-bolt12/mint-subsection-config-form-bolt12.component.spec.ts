/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup} from '@angular/forms';
/* Application Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormBolt12Component} from './mint-subsection-config-form-bolt12.component';

const makeMintQuote = (overrides: Partial<MintMintQuote>): MintMintQuote =>
	new MintMintQuote({
		id: 'quote',
		unit: 'sat',
		state: 'PAID',
		created_time: 1,
		amount_paid: 0,
		amount_issued: 0,
		payment_method: 'bolt12',
		...overrides,
	} as any);

describe('MintSubsectionConfigFormBolt12Component', () => {
	let component: MintSubsectionConfigFormBolt12Component;
	let fixture: ComponentFixture<MintSubsectionConfigFormBolt12Component>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormBolt12Component);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('method', 'bolt12');
		fixture.componentRef.setInput(
			'form_group',
			new FormGroup({
				sat: new FormGroup({
					bolt12: new FormGroup({
						min_amount: new FormControl(0),
						max_amount: new FormControl(0),
						description: new FormControl(false),
					}),
				}),
			}),
		);
		fixture.componentRef.setInput('form_status', false);
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('quotes', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
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
			fixture.componentRef.setInput('quotes', [makeMintQuote({id: 'sat'}), makeMintQuote({id: 'eur', unit: 'eur' as any})]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['sat']);
		});

		it('should sort mint quotes by created time ascending', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'newest', created_time: 3}),
				makeMintQuote({id: 'oldest', created_time: 1}),
				makeMintQuote({id: 'middle', created_time: 2}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['oldest', 'middle', 'newest']);
		});
	});

	describe('stats', () => {
		it('should chart the paid amount of mint quotes, not the issued amount', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'partial', state: 'PAID' as any, amount_paid: 21000, amount_issued: 1000}),
			]);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();
			expect(component.stat_amounts()).toEqual([{created_time: 1, amount: 21000}]);
			expect(component.stats().max).toBe(21000);
		});
	});

	describe('toggle', () => {
		it('should use the description control for nut4 and amountless for nut5', () => {
			expect(component.toggle_control()).toBe('description');
			fixture.componentRef.setInput('nut', 'nut5');
			expect(component.toggle_control()).toBe('amountless');
		});

		it('should set the toggle control and emit update on toggle', () => {
			const emitted: any[] = [];
			component.update.subscribe((event) => emitted.push(event));
			component.onToggle({checked: true} as any);
			expect(component.form_bolt12().get('description')?.value).toBe(true);
			expect(emitted.length).toBe(1);
			expect(emitted[0].control_name).toBe('description');
			expect(emitted[0].method).toBe('bolt12');
		});

		it('should disable the toggle control when the form status is set', () => {
			fixture.componentRef.setInput('form_status', true);
			fixture.detectChanges();
			expect(component.form_bolt12().get('description')?.disabled).toBe(true);
		});
	});
});
