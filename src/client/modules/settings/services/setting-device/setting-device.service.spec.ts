/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';
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
	it('treats malformed or unavailable backup acknowledgements as unacknowledged', () => {
		const storage = TestBed.inject(LocalStorageService);
		const get = spyOn(storage, 'getItem');
		get.and.returnValue({unexpected: true});
		expect(service.getFederationBackupAcknowledgements('federation')).toEqual([]);
		get.and.returnValue(['an item', false, 7]);
		expect(service.getFederationBackupAcknowledgements('federation')).toEqual(['an item']);
		get.and.throwError('Storage disabled');
		expect(service.getFederationBackupAcknowledgements('federation')).toEqual([]);
	});
});
