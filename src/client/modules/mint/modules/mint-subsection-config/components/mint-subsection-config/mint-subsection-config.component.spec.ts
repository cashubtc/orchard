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
	});
});
