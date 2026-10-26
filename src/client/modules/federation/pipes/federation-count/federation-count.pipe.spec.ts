/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
/* Local Dependencies */
import {FederationCountPipe} from './federation-count.pipe';

describe('FederationCountPipe', () => {
	let locale: string;
	let pipe: FederationCountPipe;
	beforeEach(() => {
		locale = 'en-US';
		TestBed.configureTestingModule({providers: [{provide: SettingDeviceService, useValue: {getLocale: () => locale}}]});
		pipe = TestBed.runInInjectionContext(() => new FederationCountPipe());
	});

	it('formats uint64 counters exactly', () => {
		expect(pipe.transform('18446744073709551615')).toBe('18,446,744,073,709,551,615');
		expect(pipe.transform(0)).toBe('0');
	});

	it('follows the device locale', () => {
		locale = 'de-DE';
		expect(pipe.transform('42100000')).toBe('42.100.000');
	});

	it('renders basis points as a percentage', () => {
		expect(pipe.transform('9400', 'bps')).toBe('94%');
		expect(pipe.transform('9451', 'bps')).toBe('94.51%');
	});

	it('reports absent values and leaves unknown text verbatim', () => {
		expect(pipe.transform(null)).toBe('Not reported');
		expect(pipe.transform('future')).toBe('future');
	});
});
