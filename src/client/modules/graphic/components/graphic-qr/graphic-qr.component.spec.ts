/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {GraphicQrComponent} from './graphic-qr.component';

describe('GraphicQrComponent', () => {
	let component: GraphicQrComponent;
	let fixture: ComponentFixture<GraphicQrComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcGraphicModule],
		}).compileComponents();

		fixture = TestBed.createComponent(GraphicQrComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('data', 'https://example.com');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders the symbol without a logo by default', () => {
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('.graphic-qr-modules')?.getAttribute('d')).toBeTruthy();
		expect(element.querySelector('.graphic-qr-logo')).toBeNull();
	});

	it('overlays the logo when an image is provided', () => {
		fixture.componentRef.setInput('image', '/mint-icon-placeholder.png');
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('.graphic-qr-logo')?.getAttribute('src')).toBe('/mint-icon-placeholder.png');
	});

	it('renders nothing when there is no data', () => {
		fixture.componentRef.setInput('data', '');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('svg')).toBeNull();
	});
});
