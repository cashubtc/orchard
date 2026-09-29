/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MAT_DIALOG_DATA, MatDialog} from '@angular/material/dialog';
/* Native Dependencies */
import {OrcNetworkModule} from '@client/modules/network/network.module';
/* Local Dependencies */
import {NetworkConnectionComponent} from './network-connection.component';

describe('NetworkConnectionComponent', () => {
	let component: NetworkConnectionComponent;
	let fixture: ComponentFixture<NetworkConnectionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcNetworkModule],
			providers: [
				{
					provide: MAT_DIALOG_DATA,
					useValue: {
						uri: 'https://example.com',
						name: 'test',
						image: '',
						status: 'active',
						device_type: 'desktop',
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(NetworkConnectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('turns the logo off when error correction drops below the logo floor', () => {
		component.onEccChange(0);
		expect(component.ecc()).toBe('low');
		expect(component.show_image()).toBeFalse();
	});

	it('raises error correction to the logo floor when the logo is turned back on', () => {
		component.onEccChange(1);
		component.onImageChange(true);
		expect(component.ecc()).toBe('quartile');
		expect(component.show_image()).toBeTrue();
	});

	for (const dialog_width of [288, 443]) {
		it(`keeps the QR square inside a ${dialog_width}px dialog with a vertical scrollbar`, async () => {
			const dialog = TestBed.inject(MatDialog);
			const dialog_ref = dialog.open(NetworkConnectionComponent, {
				width: `${dialog_width}px`,
				height: '450px',
				data: {
					...component.data,
					uri: `${'a'.repeat(66)}@example.onion:9735`,
					device_type: dialog_width < 400 ? 'mobile' : 'desktop',
				},
			});
			fixture.detectChanges();
			await fixture.whenStable();

			try {
				const content = document.getElementById(dialog_ref.id)!.querySelector<HTMLElement>('mat-dialog-content')!;
				const qr = content.querySelector<HTMLElement>('orc-graphic-qr')!;
				const qr_bounds = qr.getBoundingClientRect();
				const content_bounds = content.getBoundingClientRect();
				const content_style = getComputedStyle(content);
				const available_width =
					content.clientWidth - parseFloat(content_style.paddingLeft) - parseFloat(content_style.paddingRight);

				expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
				expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
				expect(qr_bounds.width).toBeGreaterThan(0);
				expect(qr_bounds.width).toBeLessThanOrEqual(available_width);
				expect(qr_bounds.height).toBeCloseTo(qr_bounds.width, 1);
				expect(qr_bounds.right).toBeLessThanOrEqual(content_bounds.left + content.clientWidth);
			} finally {
				dialog_ref.close();
				await fixture.whenStable();
			}
		});
	}
});
