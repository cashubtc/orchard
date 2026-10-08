/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintSubsectionConfigModule} from '@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module';
/* Local Dependencies */
import {MintSubsectionConfigFormLimitHintComponent} from './mint-subsection-config-form-limit-hint.component';

describe('MintSubsectionConfigFormLimitHintComponent', () => {
	let component: MintSubsectionConfigFormLimitHintComponent;
	let fixture: ComponentFixture<MintSubsectionConfigFormLimitHintComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionConfigModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionConfigFormLimitHintComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('limit', 0);
		fixture.componentRef.setInput('amounts', []);
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('type', 'min');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('counts recent quotes above a max entered in display units', () => {
		fixture.componentRef.setInput('unit', 'usd');
		fixture.componentRef.setInput('type', 'max');
		fixture.componentRef.setInput('amounts', [{amount: 1500}, {amount: 2500}, {amount: 499}]);
		fixture.componentRef.setInput('limit', 20);
		fixture.detectChanges();
		expect(component.limit_hint()).toBe(1);
	});
});
