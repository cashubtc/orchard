/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {Subject} from 'rxjs';
/* Application Dependencies */
import {PublicService} from '@client/modules/public/services/image/public.service';
import {PublicImage} from '@client/modules/public/classes/public-image.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralMintIconComponent} from './ecash-general-mint-icon.component';

describe('EcashGeneralMintIconComponent', () => {
	let component: EcashGeneralMintIconComponent;
	let fixture: ComponentFixture<EcashGeneralMintIconComponent>;
	let images: Subject<PublicImage>;
	let public_service: {getPublicImageData: jasmine.Spy};

	const data = 'data:image/png;base64,aWNvbg==';

	beforeEach(async () => {
		images = new Subject<PublicImage>();
		public_service = {getPublicImageData: jasmine.createSpy('getPublicImageData').and.callFake(() => images)};

		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [{provide: PublicService, useValue: public_service}],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintIconComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('name', 'Cedar Community Mint');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('shows initials when the mint has no icon, without asking for one', () => {
		expect(fixture.nativeElement.textContent.trim()).toBe('CC');
		expect(public_service.getPublicImageData).not.toHaveBeenCalled();
	});

	it("shows a spinner while Orchard's server fetches the icon, then the icon", () => {
		fixture.componentRef.setInput('icon_url', 'https://cedar.example/icon.png');
		fixture.detectChanges();
		expect(public_service.getPublicImageData).toHaveBeenCalledOnceWith('https://cedar.example/icon.png');
		expect(fixture.nativeElement.querySelector('mat-spinner')).not.toBeNull();

		images.next(new PublicImage({data, type: 'image/png'}));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
		expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(data);
	});

	it('falls back to initials when the icon fails, and tries again for a new icon', () => {
		fixture.componentRef.setInput('icon_url', 'https://cedar.example/icon.png');
		fixture.detectChanges();
		images.error(new Error('refused'));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('img')).toBeNull();
		expect(fixture.nativeElement.textContent.trim()).toBe('CC');

		images = new Subject<PublicImage>();
		fixture.componentRef.setInput('icon_url', 'https://cedar.example/icon-2.png');
		fixture.detectChanges();
		expect(component.icon_state()).toBe('loading');
		expect(public_service.getPublicImageData).toHaveBeenCalledWith('https://cedar.example/icon-2.png');
	});
});
