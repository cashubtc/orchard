/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Local Dependencies */
import {MintService} from './mint.service';

describe('MintService', () => {
	let service: MintService;
	let http_mock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule],
		});
		service = TestBed.inject(MintService);
		http_mock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		http_mock.verify();
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('loadMintMetricsHealth', () => {
		it('resolves the boolean when the exporter is reachable', (done) => {
			service.loadMintMetricsHealth().subscribe((healthy) => {
				expect(healthy).toBe(true);
				done();
			});
			http_mock.expectOne(() => true).flush({data: {mint_metrics_health: true}});
		});

		it('throws OrchardErrors when the query returns graphql errors', (done) => {
			service.loadMintMetricsHealth().subscribe({
				error: (error) => {
					expect(error).toBeInstanceOf(OrchardErrors);
					done();
				},
			});
			http_mock.expectOne(() => true).flush({errors: [{message: 'unreachable', extensions: {code: 40013}}]});
		});
	});
});
