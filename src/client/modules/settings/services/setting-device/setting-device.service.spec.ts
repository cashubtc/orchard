/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Local Dependencies */
import {SettingDeviceService} from './setting-device.service';

describe('SettingService', () => {
	let service: SettingDeviceService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(SettingDeviceService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
