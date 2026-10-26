/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {federationInfo} from '@client/modules/federation/helpers/federation-status.fixtures';
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
	it('reacts to a cold mode probe and places the development badge by the mint title', () => {
		const federation = TestBed.inject(FederationService);
		federation.mode.set('member');
		TestBed.inject(FederationStatusService).custody.set({onchain_wallets: []});
		fixture.detectChanges();
		expect(component.menu_items().some((item) => item.name === 'Federation')).toBeTrue();
		expect(fixture.nativeElement.querySelector('.nav-secondary-header [data-testid="mint-development-badge"]')).not.toBeNull();
		federation.mode.set('standalone');
		fixture.detectChanges();
		expect(component.menu_items().some((item) => item.name === 'Federation')).toBeFalse();
		expect(fixture.nativeElement.querySelector('[data-testid="mint-development-badge"]')).toBeNull();
	});
	it('loads federation info and custody once on a member so the badge shows without a dashboard visit', () => {
		const http = TestBed.inject(HttpTestingController);
		const federation = TestBed.inject(FederationService);
		federation.mode.set('member');
		fixture.detectChanges();
		http.expectOne((request) => request.body?.query?.includes('federation_info')).flush({data: {federation_info: federationInfo()}});
		http.expectOne((request) => request.body?.query?.includes('federation_custody_status')).flush({
			data: {federation_custody_status: {onchain_wallets: []}},
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-testid="mint-development-badge"]')).not.toBeNull();
		federation.mode.set('standalone');
		fixture.detectChanges();
		federation.mode.set('member');
		fixture.detectChanges();
		http.expectNone((request) => request.body?.query?.includes('federation_'));
	});
});
