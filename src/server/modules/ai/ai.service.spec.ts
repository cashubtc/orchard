/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Local Dependencies */
import {SettingService} from '#server/modules/setting/setting.service';
import {AiService} from './ai.service.js';
import {OllamaService} from './ollama/ollama.service.js';
import {OpenRouterService} from './openrouter/openrouter.service.js';

describe('AiService', () => {
	let aiService: AiService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiService,
				{provide: SettingService, useValue: {getSetting: jest.fn()}},
				{provide: OllamaService, useValue: {getModels: jest.fn(), streamChat: jest.fn()}},
				{provide: OpenRouterService, useValue: {getModels: jest.fn(), streamChat: jest.fn()}},
			],
		}).compile();

		aiService = module.get<AiService>(AiService);
	});

	it('should be defined', () => {
		expect(aiService).toBeDefined();
	});
});
