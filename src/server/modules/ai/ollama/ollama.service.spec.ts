/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Readable} from 'stream';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
import {SettingService} from '@server/modules/setting/setting.service';
import {SettingKey} from '@server/modules/setting/setting.enums';
/* Local Dependencies */
import {OllamaService} from './ollama.service.js';
import {AiMessageRole} from '../ai.enums.js';

describe('OllamaService', () => {
	let service: OllamaService;

	const mock_fetch_service = {
		fetchWithProxy: jest.fn(),
	};

	const mock_setting_service = {
		getStringSetting: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mock_setting_service.getStringSetting.mockImplementation((key: string) => {
			if (key === SettingKey.AI_OLLAMA_API) return Promise.resolve('http://localhost:11434');
			return Promise.resolve(null);
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OllamaService,
				{provide: FetchService, useValue: mock_fetch_service},
				{provide: SettingService, useValue: mock_setting_service},
			],
		}).compile();
		service = module.get<OllamaService>(OllamaService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/* *******************************************************
		getModels
	******************************************************** */

	describe('getModels', () => {
		it('should return normalized models from Ollama tags endpoint', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						models: [
							{
								name: 'llama3:latest',
								model: 'llama3:latest',
								modified_at: '2024-01-01T00:00:00Z',
								size: 4000000000,
								digest: 'abc123',
								details: {
									parent_model: '',
									format: 'gguf',
									family: 'llama',
									families: ['llama'],
									parameter_size: '8B',
									quantization_level: 'Q4_0',
								},
							},
						],
					}),
			});

			const models = await service.getModels();

			expect(models).toHaveLength(1);
			expect(models[0].model).toBe('llama3:latest');
			expect(models[0].name).toBe('llama3:latest');
			expect(models[0].context_length).toBe(0);
			expect(models[0].ollama?.family).toBe('llama');
			expect(models[0].ollama?.parameter_size).toBe('8B');
			expect(models[0].ollama?.size).toBe(4000000000);
		});

		it('should throw when Ollama API endpoint is not configured', async () => {
			mock_setting_service.getStringSetting.mockResolvedValue(null);

			await expect(service.getModels()).rejects.toThrow('Ollama API endpoint is not configured');
		});

		it('should throw on non-OK response', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: () => Promise.resolve('Service Unavailable'),
			});

			await expect(service.getModels()).rejects.toThrow('Ollama returned status 503');
		});
	});

	/* *******************************************************
		streamChat
	******************************************************** */

	describe('streamChat', () => {
		/** Helper to create an NDJSON readable stream */
		function createNDJSONStream(chunks: object[]): Readable {
			const lines = chunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
			return Readable.from(Buffer.from(lines));
		}

		it('should yield content chunks and a final done chunk', async () => {
			const stream = createNDJSONStream([
				{model: 'llama3', created_at: '2024-01-01T00:00:00Z', message: {role: 'assistant', content: 'Hello'}, done: false},
				{model: 'llama3', created_at: '2024-01-01T00:00:01Z', message: {role: 'assistant', content: ' there'}, done: false},
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:02Z',
					message: {role: 'assistant', content: ''},
					done: true,
					done_reason: 'stop',
					prompt_eval_count: 50,
					eval_count: 20,
					total_duration: 1000000,
					eval_duration: 500000,
				},
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'Hi'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks).toHaveLength(3);
			expect(chunks[0].message.content).toBe('Hello');
			expect(chunks[0].done).toBe(false);
			expect(chunks[1].message.content).toBe(' there');
			expect(chunks[2].done).toBe(true);
			expect(chunks[2].done_reason).toBe('stop');
			expect(chunks[2].usage?.prompt_tokens).toBe(50);
			expect(chunks[2].usage?.completion_tokens).toBe(20);
			expect(chunks[2].usage?.total_duration).toBe(1000000);
		});

		it('should map tool calls from Ollama format', async () => {
			const stream = createNDJSONStream([
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:00Z',
					message: {
						role: 'assistant',
						content: '',
						tool_calls: [{function: {name: 'GET_MINT_INFO', arguments: {verbose: true}}}],
					},
					done: false,
				},
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:01Z',
					message: {role: 'assistant', content: ''},
					done: true,
					done_reason: 'stop',
					prompt_eval_count: 10,
					eval_count: 5,
				},
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks[0].message.tool_calls).toHaveLength(1);
			expect(chunks[0].message.tool_calls![0].function.name).toBe('GET_MINT_INFO');
			expect(chunks[0].message.tool_calls![0].function.arguments).toEqual({verbose: true});
		});

		it('should pass through the thinking field', async () => {
			const stream = createNDJSONStream([
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:00Z',
					message: {role: 'assistant', content: 'Answer', thinking: 'Let me think about this...'},
					done: false,
				},
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:01Z',
					message: {role: 'assistant', content: ''},
					done: true,
					done_reason: 'stop',
				},
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'think'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks[0].message.thinking).toBe('Let me think about this...');
		});

		it('should throw on non-OK response', async () => {
			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve('model not found'),
			});

			const gen = service.streamChat('missing-model', [{role: AiMessageRole.USER, content: 'test'}], []);
			await expect(gen.next()).rejects.toThrow('Ollama returned status 404');
		});

		it('should handle error field in stream chunk', async () => {
			const stream = createNDJSONStream([
				{
					model: 'llama3',
					created_at: '2024-01-01T00:00:00Z',
					message: {role: 'assistant', content: ''},
					done: true,
					error: 'out of memory',
				},
			]);

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks[0].error).toBe('out of memory');
		});

		it('should skip unparseable NDJSON lines gracefully', async () => {
			const raw =
				'{"model":"llama3","created_at":"2024-01-01T00:00:00Z","message":{"role":"assistant","content":"ok"},"done":false}\nBAD_JSON\n{"model":"llama3","created_at":"2024-01-01T00:00:01Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}\n';
			const stream = Readable.from(Buffer.from(raw));

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			/* Bad line is skipped, two valid chunks */
			expect(chunks).toHaveLength(2);
			expect(chunks[0].message.content).toBe('ok');
			expect(chunks[1].done).toBe(true);
		});

		it('should parse remaining buffer after stream ends', async () => {
			/* No trailing newline — forces buffer parsing in the finally path */
			const raw =
				'{"model":"llama3","created_at":"2024-01-01T00:00:00Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}';
			const stream = Readable.from(Buffer.from(raw));

			mock_fetch_service.fetchWithProxy.mockResolvedValueOnce({ok: true, body: stream});

			const chunks = [];
			for await (const chunk of service.streamChat('llama3', [{role: AiMessageRole.USER, content: 'test'}], [])) {
				chunks.push(chunk);
			}

			expect(chunks).toHaveLength(1);
			expect(chunks[0].done).toBe(true);
		});
	});
});
