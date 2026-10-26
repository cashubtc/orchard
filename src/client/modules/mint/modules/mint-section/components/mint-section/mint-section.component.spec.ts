/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {NavService} from '@client/modules/nav/services/nav/nav.service';
/* Native Dependencies */
import {OrcMintSectionModule} from '@client/modules/mint/modules/mint-section/mint-section.module';
/* Local Dependencies */
import {MintSectionComponent} from './mint-section.component';

describe('MintSectionComponent', () => {
	let component: MintSectionComponent;
	let fixture: ComponentFixture<MintSectionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSectionModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should source menu items from the nav service', () => {
		expect(component.menu_items()).toEqual(TestBed.inject(NavService).getMenuItems('mint'));
	});
	it('reacts to a cold mode probe and keeps the header to the mint itself', () => {
		const http = TestBed.inject(HttpTestingController);
		const federation = TestBed.inject(FederationService);
		federation.mode.set('member');
		fixture.detectChanges();
		expect(component.menu_items().some((item) => item.name === 'Federation')).toBeTrue();
		expect(fixture.nativeElement.querySelector('.nav-secondary-header .label-state')).toBeNull();
		http.expectNone((request) => request.body?.query?.includes('federation_'));
		federation.mode.set('standalone');
		fixture.detectChanges();
		expect(component.menu_items().some((item) => item.name === 'Federation')).toBeFalse();
	});
});
