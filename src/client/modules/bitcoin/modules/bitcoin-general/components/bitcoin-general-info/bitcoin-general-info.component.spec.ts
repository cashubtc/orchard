/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
/* Application Dependencies */
import {ThemeType} from '@client/modules/cache/services/local-storage/local-storage.types';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {NetworkConnection} from '@client/modules/network/types/network-connection.type';
/* Native Dependencies */
import {OrcBitcoinGeneralModule} from '@client/modules/bitcoin/modules/bitcoin-general/bitcoin-general.module';
/* Local Dependencies */
import {BitcoinGeneralInfoComponent} from './bitcoin-general-info.component';

describe('BitcoinGeneralInfoComponent', () => {
	let component: BitcoinGeneralInfoComponent;
	let fixture: ComponentFixture<BitcoinGeneralInfoComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcBitcoinGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(BitcoinGeneralInfoComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('blockchain_info', null);
		fixture.componentRef.setInput('network_info', null);
		fixture.componentRef.setInput('blockcount', 0);
		fixture.componentRef.setInput('error', false);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	for (const theme of [ThemeType.LIGHT_MODE, ThemeType.DARK_MODE]) {
		it(`uses a ${theme === ThemeType.LIGHT_MODE ? 'white' : 'black'} block logo in ${theme}`, async () => {
			spyOn(TestBed.inject(SettingDeviceService), 'getTheme').and.returnValue(theme);
			const open_dialog = spyOn(TestBed.inject(MatDialog), 'open');
			await component.onUriClick({uri: 'example.com:8333', type: 'clearnet', label: 'example.com:8333'});

			const image = new Image();
			const connection = open_dialog.calls.mostRecent().args[1]!.data as NetworkConnection;
			image.src = connection.image;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d')!;
			context.drawImage(image, 0, 0);
			const pixel = Array.from(context.getImageData(32, 64, 1, 1).data);
			const channel = theme === ThemeType.LIGHT_MODE ? 255 : 0;
			expect(pixel).toEqual([channel, channel, channel, 255]);
		});
	}
});
