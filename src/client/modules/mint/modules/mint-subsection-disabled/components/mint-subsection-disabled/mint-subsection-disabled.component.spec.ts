/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter, type UrlTree} from '@angular/router';
/* Native Dependencies */
import {OrcMintSubsectionDisabledModule} from '@client/modules/mint/modules/mint-subsection-disabled/mint-subsection-disabled.module';
/* Local Dependencies */
import {MintSubsectionDisabledComponent} from './mint-subsection-disabled.component';

describe('MintSubsectionDisabledComponent', () => {
	let component: MintSubsectionDisabledComponent;
	let fixture: ComponentFixture<MintSubsectionDisabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			providers: [provideRouter([])],
			imports: [OrcMintSubsectionDisabledModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDisabledComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('links to service settings', () => {
		expect(component).toBeTruthy();
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
		fixture.nativeElement.querySelector('button').click();
		expect(router.serializeUrl(navigate.calls.mostRecent().args[0] as UrlTree)).toBe('/settings/services');
	});
});
