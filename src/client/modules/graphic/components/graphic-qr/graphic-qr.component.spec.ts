/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
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

	it('does not offer expansion unless enabled', () => {
		expect(fixture.nativeElement.querySelector('button')).toBeNull();
	});

	it('opens an expanded QR without bubbling the click to its row', async () => {
		fixture.componentRef.setInput('expandable', true);
		fixture.componentRef.setInput('dialog_title', 'Orchard invite link');
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		const row_click = jasmine.createSpy('row click');
		element.addEventListener('click', row_click);
		const button = element.querySelector<HTMLButtonElement>('button')!;
		expect(button.getAttribute('aria-label')).toBe('Expand Orchard invite link');
		expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		button.click();
		fixture.detectChanges();
		await fixture.whenStable();

		const dialog = TestBed.inject(MatDialog);
		try {
			expect(row_click).not.toHaveBeenCalled();
			expect(dialog.openDialogs.length).toBe(1);
			expect(document.querySelector('orc-graphic-qr-dialog [mat-dialog-title]')?.textContent).toContain('Orchard invite link');
			expect(document.querySelector('orc-graphic-qr-dialog .graphic-qr-expand')).toBeNull();
		} finally {
			dialog.closeAll();
			await fixture.whenStable();
		}
	});
});
