/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter, type UrlTree} from '@angular/router';
/* Native Dependencies */
import {OrcLightningSubsectionDisabledModule} from '@client/modules/lightning/modules/lightning-subsection-disabled/lightning-subsection-disabled.module';
/* Local Dependencies */
import {LightningSubsectionDisabledComponent} from './lightning-subsection-disabled.component';

describe('LightningSubsectionDisabledComponent', () => {
	let component: LightningSubsectionDisabledComponent;
	let fixture: ComponentFixture<LightningSubsectionDisabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			providers: [provideRouter([])],
			imports: [OrcLightningSubsectionDisabledModule],
		}).compileComponents();

		fixture = TestBed.createComponent(LightningSubsectionDisabledComponent);
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
