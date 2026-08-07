/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Readable} from 'stream';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
import {SettingService} from '@server/modules/setting/setting.service';
import {SettingKey} from '@server/modules/setting/setting.enums';
/* Local Dependencies */
import {OpenRouterService} from './openrouter.service.js';
import {AiMessageRole} from '../ai.enums.js';

describe('OpenRouterService', () => {
	let service: OpenRouterService;

	const mock_fetch_service = {
		fetchWithProxy: jest.fn(),
	};

	const mock_setting_service = {
		getStringSetting: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mock_setting_service.getStringSetting.mockImplementation((key: string) => {
			if (key === SettingKey.AI_OPENROUTER_KEY) return Promise.resolve('sk-test-key');
			return Promise.resolve(null);
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OpenRouterService,
				{provide: FetchService, useValue: mock_fetch_service},
				{provide: SettingService, useValue: mock_setting_service},
			],
		}).compile();
		service = module.get<OpenRouterService>(OpenRouterService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/* *******************************************************
		getModels
	******************************************************** */

	describe('getModels', () => {
		it('should return normalized models', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								id: 'anthropic/claude-3.5-sonnet',
								name: 'Claude 3.5 Sonnet',
								created: 1700000000,
								context_length: 200000,
								architecture: {modality: 'text', tokenizer: 'claude', instruct_type: null},
								pricing: {prompt: '0.003', completion: '0.015'},
								top_provider: {max_completion_tokens: 8192, is_moderated: false},
							},
						],
					}),
			});

			const models = await service.getModels();

			expect(models).toHaveLength(1);
			expect(models[0].model).toBe('anthropic/claude-3.5-sonnet');
			expect(models[0].name).toBe('Claude 3.5 Sonnet');
			expect(models[0].context_length).toBe(200000);
			expect(models[0].openrouter?.family).toBe('anthropic');
			expect(models[0].openrouter?.pricing_prompt).toBe('0.003');
		});

		it('should throw when API key is not configured', async () => {
			mock_setting_service.getStringSetting.mockResolvedValue(null);

			await expect(service.getModels()).rejects.toThrow('OpenRouter API key is not configured');
		});

		it('should throw on non-OK response', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: false, status: 401});

			await expect(service.getModels()).rejects.toThrow('OpenRouter returned status 401');
		});
	});

	/* *******************************************************
		streamChat
	******************************************************** */

	describe('streamChat', () => {
		/** Helper to create an SSE readable stream from an array of SSE payloads */
		function createSSEStream(payloads: string[]): Readable {
			const lines = payloads.map((p) => `data: ${p}\n\n`).join('');
			return Readable.from(Buffer.from(lines));
		}

		it('should yield content delta chunks and a done chunk', async () => {
			const stream = createSSEStream([
				JSON.stringify({
					id: 'gen-1',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'anthropic/claude-3.5-sonnet',
					choices: [{index: 0, delta: {role: 'assistant', content: 'Hello'}, finish_reason: null}],
				}),
				JSON.stringify({
					id: 'gen-1',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'anthropic/claude-3.5-sonnet',
					choices: [{index: 0, delta: {content: ' world'}, finish_reason: null}],
				}),
				'[DONE]',
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			const messages = [{role: AiMessageRole.USER, content: 'Hi'}];
			for await (const chunk of service.streamChat('anthropic/claude-3.5-sonnet', messages, [])) {
				chunks.push(chunk);
			}

			/* Two content deltas + one done chunk */
			expect(chunks.length).toBe(3);
			expect(chunks[0].message.content).toBe('Hello');
			expect(chunks[1].message.content).toBe(' world');
			expect(chunks[2].done).toBe(true);
		});

		it('should accumulate tool call deltas across chunks', async () => {
			const stream = createSSEStream([
				JSON.stringify({
					id: 'gen-2',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [
						{
							index: 0,
							delta: {
								role: 'assistant',
								content: '',
								tool_calls: [{index: 0, id: 'tc-1', type: 'function', function: {name: 'GET_MINT_INFO', arguments: ''}}],
							},
							finish_reason: null,
						},
					],
				}),
				JSON.stringify({
					id: 'gen-2',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [
						{
							index: 0,
							delta: {tool_calls: [{index: 0, function: {arguments: '{"foo":'}}]},
							finish_reason: null,
						},
					],
				}),
				JSON.stringify({
					id: 'gen-2',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [
						{
							index: 0,
							delta: {tool_calls: [{index: 0, function: {arguments: '"bar"}'}}]},
							finish_reason: null,
						},
					],
				}),
				'[DONE]',
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('test-model', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			const done_chunk = chunks.find((c) => c.done);
			expect(done_chunk).toBeDefined();
			expect(done_chunk!.message.tool_calls).toHaveLength(1);
			expect(done_chunk!.message.tool_calls![0].id).toBe('tc-1');
			expect(done_chunk!.message.tool_calls![0].function.arguments).toEqual({foo: 'bar'});
		});

		it('should include usage data in the done chunk when provided', async () => {
			const stream = createSSEStream([
				JSON.stringify({
					id: 'gen-3',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [{index: 0, delta: {role: 'assistant', content: 'Hi'}, finish_reason: 'stop'}],
					usage: {prompt_tokens: 100, completion_tokens: 25, total_tokens: 125},
				}),
				'[DONE]',
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('test-model', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			const done_chunk = chunks.find((c) => c.done);
			expect(done_chunk!.usage?.prompt_tokens).toBe(100);
			expect(done_chunk!.usage?.completion_tokens).toBe(25);
		});

		it('should throw on non-OK response', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: () => Promise.resolve('Internal Server Error'),
			});

			const gen = service.streamChat('test-model', [{role: AiMessageRole.USER, content: 'test'}], []);
			await expect(gen.next()).rejects.toThrow('OpenRouter returned status 500');
		});

		it('should skip keepalive comments and empty lines', async () => {
			const raw =
				': keepalive\n\ndata: ' +
				JSON.stringify({
					id: 'gen-4',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [{index: 0, delta: {role: 'assistant', content: 'ok'}, finish_reason: null}],
				}) +
				'\n\n\n\ndata: [DONE]\n\n';

			const stream = Readable.from(Buffer.from(raw));
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('test-model', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks).toHaveLength(2);
			expect(chunks[0].message.content).toBe('ok');
			expect(chunks[1].done).toBe(true);
		});

		it('should format assistant tool_calls and tool result messages correctly', async () => {
			const stream = createSSEStream([
				JSON.stringify({
					id: 'gen-5',
					object: 'chat.completion.chunk',
					created: 1700000000,
					model: 'test-model',
					choices: [{index: 0, delta: {role: 'assistant', content: 'done'}, finish_reason: 'stop'}],
				}),
				'[DONE]',
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const messages = [
				{role: AiMessageRole.SYSTEM, content: 'You are helpful'},
				{
					role: AiMessageRole.ASSISTANT,
					content: '',
					tool_calls: [{id: 'tc-1', function: {name: 'GET_MINT_INFO' as any, arguments: {foo: 'bar'}}}],
				},
				{role: AiMessageRole.TOOL, content: '{"result":true}', tool_call_id: 'tc-1'},
				{role: AiMessageRole.USER, content: 'thanks'},
			];

			const chunks = [];
			for await (const chunk of service.streamChat('test-model', messages, [])) {
				chunks.push(chunk);
			}

			/* Verify the fetch body serialized the messages correctly */
			const call_body = JSON.parse(mock_fetch_service.fetchWithProxy.mock.calls[0][1].body);
			expect(call_body.messages[1].tool_calls[0].function.arguments).toBe('{"foo":"bar"}');
			expect(call_body.messages[2].tool_call_id).toBe('tc-1');
		});
	});
});
