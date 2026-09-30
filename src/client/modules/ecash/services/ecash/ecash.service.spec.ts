/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Local Dependencies */
import {EcashService} from './ecash.service';

describe('EcashService', () => {
	let service: EcashService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(EcashService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
