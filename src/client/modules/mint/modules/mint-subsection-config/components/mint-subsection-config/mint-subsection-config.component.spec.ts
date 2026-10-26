/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {FormGroup} from '@angular/forms';
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Vendor Dependencies */
import {of} from 'rxjs';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {settingsComparison, settingsDifference} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {FederationSettingsComparisonStatus} from '@shared/generated.types';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
/* Local Dependencies */
import {MintSubsectionConfigComponent} from './mint-subsection-config.component';

describe('MintSubsectionConfigComponent', () => {
	let component: MintSubsectionConfigComponent;
	let fixture: ComponentFixture<MintSubsectionConfigComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule, MatIconTestingModule],
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
	it('renders member scope, local TTLs and method-specific limit and option hints', () => {
		fixture.destroy();
		TestBed.inject(FederationService).mode.set('member');
		const load = spyOn(FederationSettingsService.prototype, 'load');
		const data = TestBed.inject(ActivatedRoute).snapshot.data;
		data['mint_info'].nuts.nut4.methods = [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 100, description: false}];
		fixture = TestBed.createComponent(MintSubsectionConfigComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		const result = settingsComparison();
		result.members[1].status = FederationSettingsComparisonStatus.Differs;
		result.members[1].differences = [
			settingsDifference({this_member_value: '100', their_value: '200'}),
			settingsDifference({setting: 'options', this_member_value: null, their_value: '{"description":true}'}),
			settingsDifference({setting: 'method', nut: 5, method: 'bolt12', unit: 'usd', this_member_value: 'false', their_value: 'true'}),
		];
		TestBed.inject(FederationSettingsService).comparison.set(result);
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('These settings apply to this member only.');
		expect(element.textContent).toContain('This member only. Not visible to the other members.');
		expect(element.textContent).toContain('Applies to all methods and units on this member.');
		expect(element.textContent).toContain('Member 1 is the default quote member.');
		expect(element.textContent).toContain('NUT-05 bolt12 usd method');
		const method = element.querySelector('orc-mint-subsection-config-form-method');
		expect(method?.textContent).toContain('Differs on member 2: 200');
		expect(method?.textContent).toContain('Differs on member 2: {"description":true}');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('omits member scope and comparisons for a standalone mint', () => {
		expect(fixture.nativeElement.querySelector('orc-federation-settings-summary')).toBeNull();
		expect(fixture.nativeElement.textContent).not.toContain('This member only.');
		expect(fixture.nativeElement.textContent).toContain('Applies to all methods and units on this mint.');
	});
});
