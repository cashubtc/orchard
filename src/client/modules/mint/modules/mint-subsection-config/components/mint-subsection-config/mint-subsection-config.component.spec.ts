/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {FormGroup} from '@angular/forms';
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Vendor Dependencies */
import {of} from 'rxjs';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
/* Local Dependencies */
import {MintSubsectionConfigComponent} from './mint-subsection-config.component';

describe('MintSubsectionConfigComponent', () => {
	let component: MintSubsectionConfigComponent;
	let fixture: ComponentFixture<MintSubsectionConfigComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
			declarations: [MintSubsectionConfigComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							data: {
								mint_info: {
									nuts: {
										nut4: {disabled: false, methods: []},
										nut5: {disabled: false, methods: []},
										nut7: {supported: false},
										nut8: {supported: false},
										nut9: {supported: false},
										nut10: {supported: false},
										nut11: {supported: false},
										nut12: {supported: false},
										nut14: {supported: false},
										nut15: {methods: []},
										nut17: {supported: []},
										nut19: {},
										nut20: {supported: false},
									},
								},
								mint_quote_ttl: {mint_ttl: 0, melt_ttl: 0},
							},
						},
					},
				},
				{
					provide: MintService,
					useValue: {
						mint_info$: of(null),
						loadMintMintQuotes: () => of([]),
						loadMintMeltQuotes: () => of([]),
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('buildDynamicFormElements', () => {
		it('should place NUT-4 onchain confirmations in the method form group', () => {
			component.mint_info = {
				nuts: {
					nut4: {
						disabled: false,
						methods: [
							{
								method: 'onchain',
								unit: 'sat',
								min_amount: 1000,
								max_amount: 1000000,
								options: {confirmations: 6},
							},
						],
					},
					nut5: {disabled: false, methods: []},
				},
			} as any;
			component.minting_units = ['sat'];
			component.melting_units = [];

			(component as any).buildDynamicFormElements();
			const form_onchain = component.form_minting.get('sat')?.get('onchain') as FormGroup;

			expect(form_onchain.get('confirmations')?.value).toBe(6);
			expect(form_onchain.get('confirmations')?.disabled).toBeTrue();
		});

		it('should validate a custom unit as a whole number, not as cents', () => {
			component.mint_info = {
				nuts: {
					nut4: {
						disabled: false,
						methods: [{method: 'branch', unit: 'ora', min_amount: 1, max_amount: 500000}],
					},
					nut5: {disabled: false, methods: []},
				},
			} as any;
			component.minting_units = ['ora'];
			component.melting_units = [];

			(component as any).buildDynamicFormElements();
			const form_branch = component.form_minting.get('ora')?.get('branch') as FormGroup;

			expect(form_branch.get('min_amount')?.value).toBe(1);
			expect(form_branch.get('max_amount')?.value).toBe(500000);
			expect(form_branch.get('min_amount')?.valid).toBeTrue();
			expect(form_branch.get('max_amount')?.valid).toBeTrue();
		});

		it('should keep fiat limits at two decimals', () => {
			component.mint_info = {
				nuts: {
					nut4: {
						disabled: false,
						methods: [{method: 'bolt11', unit: 'usd', min_amount: 100, max_amount: 500}],
					},
					nut5: {disabled: false, methods: []},
				},
			} as any;
			component.minting_units = ['usd'];
			component.melting_units = [];

			(component as any).buildDynamicFormElements();
			const form_bolt11 = component.form_minting.get('usd')?.get('bolt11') as FormGroup;

			expect(form_bolt11.get('min_amount')?.value).toBe('1.00');
			expect(form_bolt11.get('max_amount')?.value).toBe('5.00');
		});
	});

	describe('method sections', () => {
		beforeEach(() => {
			component.mint_info = {
				nuts: {
					nut4: {
						disabled: false,
						methods: [
							{method: 'bolt11', unit: 'sat'},
							{method: 'bolt12', unit: 'sat'},
							{method: 'branch', unit: 'ora'},
						],
					},
					nut5: {disabled: false, methods: [{method: 'branch', unit: 'ora'}]},
				},
			} as any;
			component.minting_units = ['sat', 'ora'];
			component.melting_units = ['ora'];
			component.mint_quotes_by_method = {bolt11: [{id: 'q1'}] as any};
			component.melt_quotes_by_method = {};
			(component as any).buildMethodSections();
		});

		it('should pair every advertised method with its unit, grouped by unit', () => {
			expect(component.minting_sections.map((section) => section.key)).toEqual(['sat:bolt11', 'sat:bolt12', 'ora:branch']);
			expect(component.melting_sections.map((section) => section.key)).toEqual(['ora:branch']);
		});

		it('should attach the quotes recorded against each method', () => {
			expect(component.minting_sections[0].quotes.length).toBe(1);
			expect(component.minting_sections[2].quotes).toEqual([]);
		});

		it('should list the distinct minting methods for the quote ttl caveat', () => {
			expect(component.nut4_methods).toEqual(['bolt11', 'bolt12', 'branch']);
		});

		it('should label and icon known methods, falling back to the mint own name', () => {
			expect(component.getMethodDisplay('bolt11')).toEqual({label: 'Bolt 11', icon: 'bolt', svg_icon: false});
			expect(component.getMethodDisplay('bolt12')).toEqual({label: 'Bolt 12', icon: 'double_bolt', svg_icon: true});
			expect(component.getMethodDisplay('onchain')).toEqual({label: 'Onchain', icon: 'deployed_code', svg_icon: false});
			expect(component.getMethodDisplay('branch')).toEqual({label: 'branch', icon: 'payments', svg_icon: false});
		});
	});

	describe('groupQuotesByMethod', () => {
		it('should bucket quotes by their payment method', () => {
			const quotes = [
				{payment_method: 'bolt11', id: 'a'},
				{payment_method: 'branch', id: 'b'},
				{payment_method: 'bolt11', id: 'c'},
			] as any[];

			const grouped = (component as any).groupQuotesByMethod(quotes);

			expect(grouped['bolt11'].map((quote: any) => quote.id)).toEqual(['a', 'c']);
			expect(grouped['branch'].map((quote: any) => quote.id)).toEqual(['b']);
			expect(grouped['onchain']).toBeUndefined();
		});
	});
});
