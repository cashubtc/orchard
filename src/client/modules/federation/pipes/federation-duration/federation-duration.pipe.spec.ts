/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
/* Local Dependencies */
import {FederationDurationPipe} from './federation-duration.pipe';

describe('FederationDurationPipe', () => {
	let pipe: FederationDurationPipe;
	beforeEach(() => {
		TestBed.configureTestingModule({providers: [{provide: SettingDeviceService, useValue: {getLocale: () => 'en-US'}}]});
		pipe = TestBed.runInInjectionContext(() => new FederationDurationPipe());
	});

	it('renders seconds as a readable duration', () => {
		expect(pipe.transform('1080')).toBe('18 min');
		expect(pipe.transform('100')).toBe('1 min, 40 sec');
		expect(pipe.transform('0')).toBe('0 sec');
	});

	it('renders milliseconds', () => {
		expect(pipe.transform('12', 'milliseconds')).toBe('12 ms');
	});

	it('reports absent values and leaves unknown or oversized values verbatim', () => {
		expect(pipe.transform(null)).toBe('Not reported');
		expect(pipe.transform('future')).toBe('future');
		expect(pipe.transform('18446744073709551615')).toBe('18446744073709551615');
	});
});
