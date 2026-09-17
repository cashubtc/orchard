/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup} from '@angular/forms';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormQuoteTtlComponent} from './mint-subsection-config-form-quote-ttl.component';

describe('MintSubsectionConfigFormQuoteTtlComponent', () => {
	let component: MintSubsectionConfigFormQuoteTtlComponent;
	let fixture: ComponentFixture<MintSubsectionConfigFormQuoteTtlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormQuoteTtlComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('form_group', new FormGroup({mint_ttl: new FormControl(0)}));
		fixture.componentRef.setInput('control_name', 'mint_ttl');
		fixture.componentRef.setInput('control_dirty', false);
		fixture.componentRef.setInput('control_invalid', false);
		fixture.componentRef.setInput('control_errors', null);
		fixture.componentRef.setInput('disabled', false);
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('quotes', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('bolt11 caveat', () => {
		it('should show the caveat when bolt11 sits alongside another method', () => {
			fixture.componentRef.setInput('methods', ['bolt11', 'branch']);
			expect(component.help_text()).toContain('only applies to the <b>bolt11</b> payment method');
		});

		it('should hide the caveat when bolt11 is the only advertised method', () => {
			fixture.componentRef.setInput('methods', ['bolt11']);
			expect(component.help_text()).not.toContain('bolt11');
		});

		it('should hide the caveat when the mint advertises no bolt11 method', () => {
			fixture.componentRef.setInput('methods', ['branch']);
			expect(component.help_text()).not.toContain('bolt11');
		});

		it('should hide the caveat when no methods are supplied', () => {
			expect(component.help_text()).not.toContain('bolt11');
		});

		it('should never show the caveat for melt quotes', () => {
			fixture.componentRef.setInput('nut', 'nut5');
			fixture.componentRef.setInput('methods', ['bolt11', 'branch']);
			expect(component.help_text()).not.toContain('bolt11');
		});
	});
});
