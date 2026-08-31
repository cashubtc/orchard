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
import {MintSubsectionConfigFormOnchainComponent} from './mint-subsection-config-form-onchain.component';

const makeMintQuote = (overrides: Partial<MintMintQuote>): MintMintQuote =>
	new MintMintQuote({
		id: 'quote',
		unit: 'sat',
		state: 'PAID',
		created_time: 1,
		amount_paid: 0,
		amount_issued: 0,
		payment_method: 'onchain',
		...overrides,
	} as any);

const makeMeltQuote = (overrides: Partial<MintMeltQuote>): MintMeltQuote =>
	new MintMeltQuote({
		id: 'quote',
		unit: 'sat',
		state: 'PAID',
		created_time: 1,
		amount: 0,
		payment_method: 'onchain',
		...overrides,
	} as any);

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
		fixture.componentRef.setInput(
			'form_group',
			new FormGroup({
				sat: new FormGroup({
					onchain: new FormGroup({
						min_amount: new FormControl(0),
						max_amount: new FormControl(0),
						confirmations: new FormControl({value: null, disabled: true}),
					}),
				}),
			}),
		);
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

		it('should reject mint quotes without a created time', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'timed'}),
				makeMintQuote({id: 'untimed', created_time: null as any}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['timed']);
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
				makeMeltQuote({id: 'pending', state: 'PENDING' as any}),
			]);
			expect(component.valid_quotes().map((quote) => quote.id)).toEqual(['paid']);
		});
	});

	describe('stats', () => {
		it('should chart the paid amount of mint quotes, not the issued amount', () => {
			fixture.componentRef.setInput('quotes', [
				makeMintQuote({id: 'partial', state: 'PAID' as any, amount_paid: 120000, amount_issued: 90000}),
			]);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();
			expect(component.stat_amounts()).toEqual([{created_time: 1, amount: 120000}]);
			expect(component.stats().max).toBe(120000);
		});

		it('should chart the amount of melt quotes for nut5', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			fixture.componentRef.setInput('quotes', [makeMeltQuote({id: 'melted', amount: 50000})]);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();
			expect(component.stat_amounts()).toEqual([{created_time: 1, amount: 50000}]);
		});
	});

	describe('confirmations select', () => {
		it('should render a disabled select with options 1 to 12 for nut4', () => {
			const select = fixture.nativeElement.querySelector('mat-select');
			expect(select).toBeTruthy();
			expect(select.getAttribute('aria-disabled')).toBe('true');
			expect(component.confirmation_options).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		});

		it('should render the configured confirmations from the form group', () => {
			fixture.componentRef.setInput(
				'form_group',
				new FormGroup({
					sat: new FormGroup({
						onchain: new FormGroup({
							min_amount: new FormControl(0),
							max_amount: new FormControl(0),
							confirmations: new FormControl({value: 18, disabled: true}),
						}),
					}),
				}),
			);
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

	describe('actions up', () => {
		it('should emit update with the method context', () => {
			const emitted: any[] = [];
			component.update.subscribe((event) => emitted.push(event));
			component.onUpdate('min_amount');
			expect(emitted.length).toBe(1);
			expect(emitted[0].nut).toBe('nut4');
			expect(emitted[0].unit).toBe('sat');
			expect(emitted[0].method).toBe('onchain');
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
