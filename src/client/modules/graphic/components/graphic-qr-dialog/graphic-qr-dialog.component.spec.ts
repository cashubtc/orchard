/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

/* Vendor Dependencies */
import {MAT_DIALOG_DATA} from '@angular/material/dialog';

/* Native Dependencies */
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {GraphicQrComponent} from '@client/modules/graphic/components/graphic-qr/graphic-qr.component';
import {QrDialogData} from '@client/modules/graphic/types/graphic-qr.types';
import {GraphicQrDialogComponent} from './graphic-qr-dialog.component';

describe('GraphicQrDialogComponent', () => {
	let fixture: ComponentFixture<GraphicQrDialogComponent>;
	let data: QrDialogData;

	beforeEach(async () => {
		data = {title: 'Lightning invoice', data: 'lnbc1' + 'invoice'.repeat(80), image: null, ecc: 'quartile'};
		await TestBed.configureTestingModule({
			imports: [OrcGraphicModule],
			providers: [{provide: MAT_DIALOG_DATA, useValue: data}],
		}).compileComponents();
	});

	/** Creates a dialog with the current fixture data. */
	function createDialog(): GraphicQrComponent {
		fixture = TestBed.createComponent(GraphicQrDialogComponent);
		fixture.detectChanges();
		return fixture.debugElement.query(By.directive(GraphicQrComponent)).componentInstance as GraphicQrComponent;
	}

	it('shows a larger non-expandable QR with only download and cancel actions', () => {
		const qr = createDialog();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('[mat-dialog-title]')?.textContent).toContain(data.title);
		expect(qr.data()).toBe(data.data);
		expect(qr.size()).toBe(512);
		expect(qr.expandable()).toBeFalse();
		expect(element.querySelector('orc-button-copy, mat-slide-toggle, .graphic-qr-expand')).toBeNull();
		expect(Array.from(element.querySelectorAll('button'), (button) => button.textContent?.trim())).toEqual(['Download', 'Cancel']);
	});

	it('changes QR density when quality changes, without changing its payload', () => {
		const qr = createDialog();
		const before = qr.view_box();
		const slider: HTMLInputElement = fixture.nativeElement.querySelector('input[matSliderThumb]');
		slider.value = '0';
		slider.dispatchEvent(new Event('input', {bubbles: true}));
		slider.dispatchEvent(new Event('change', {bubbles: true}));
		fixture.detectChanges();
		expect(qr.ecc()).toBe('low');
		expect(qr.view_box()).not.toBe(before);
		expect(qr.data()).toBe(data.data);
	});

	it('preserves the logo and enforces its minimum error correction', () => {
		data.image = '/mint-icon-placeholder.png';
		data.ecc = 'low';
		const qr = createDialog();
		expect(qr.image()).toBe(data.image);
		expect(qr.ecc()).toBe('quartile');
		expect(fixture.nativeElement.querySelector('input[matSliderThumb]').min).toBe('2');
	});

	it('downloads the current QR with a descriptive filename', () => {
		const qr = createDialog();
		const download = spyOn(qr, 'download').and.resolveTo();
		fixture.componentInstance.download();
		expect(download).toHaveBeenCalledOnceWith('lightning_invoice_qr');
	});
});
