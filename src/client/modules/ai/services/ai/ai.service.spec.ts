/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
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

	it('should abort the open stream when called with no id', () => {
		// The stop button passes `ai_conversation()?.id`, which is undefined once a
		// route change has cleared the conversation out from under an active stream.
		const gql_client = TestBed.inject(ApiService).gql_client;
		const subscribe_spy = spyOn(gql_client, 'subscribe').and.returnValue(() => undefined);
		service.openAiSocket(AiAssistant.Default, 'hello');
		const payload = subscribe_spy.calls.mostRecent().args[0] as unknown as {variables: {ai_chat: {id: string}}};
		const stream_id = payload.variables.ai_chat.id;

		service.abortAiSocket();

		const request = http_mock.expectOne(() => true);
		expect(request.request.body.variables.id).toBe(stream_id);
		request.flush({data: {ai_chat_abort: {id: stream_id}}});
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
