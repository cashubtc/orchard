/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
/* Shared Dependencies */
import {AiAssistant} from '@shared/generated.types';
/* Local Dependencies */
import {AiService} from './ai.service';

describe('AiService', () => {
	let service: AiService;
	let http_mock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(AiService);
		http_mock = TestBed.inject(HttpTestingController);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should serve a repeated assistant request from cache', () => {
		const assistant_response = {
			data: {
				ai_assistant: {
					name: 'Mint Keysets',
					description: '',
					icon: 'account_balance',
					section: 'mint',
					system_message: {content: ''},
					tools: [],
				},
			},
		};

		service.getAiAssistant(AiAssistant.MintKeysets).subscribe();
		http_mock.expectOne(() => true).flush(assistant_response);

		let cached_name = '';
		service.getAiAssistant(AiAssistant.MintKeysets).subscribe((definition) => (cached_name = definition.name));
		http_mock.verify();
		expect(cached_name).toBe('Mint Keysets');
	});
});
