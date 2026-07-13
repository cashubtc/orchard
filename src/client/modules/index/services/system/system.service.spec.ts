/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Local Dependencies */
import {SystemService} from './system.service';

describe('SystemService', () => {
	let service: SystemService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(SystemService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
