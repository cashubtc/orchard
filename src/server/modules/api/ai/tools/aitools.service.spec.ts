import {ToolService} from '@server/modules/ai/tools/tool.service';
import {AiToolsService} from './aitools.service';

describe('AiToolsService', () => {
	let service: AiToolsService;

	beforeEach(() => {
		const toolService = new ToolService({} as any, {get: jest.fn()} as any);
		service = new AiToolsService(toolService);
	});

	describe('getTools', () => {
		it('should return all registered tools', () => {
			const tools = service.getTools();
			expect(tools.length).toBeGreaterThanOrEqual(16);
			expect(tools.map((tool) => tool.name)).toContain('GET_MINT_METRICS');
		});

		it('should return tools with correct shape', () => {
			const tools = service.getTools();
			for (const tool of tools) {
				expect(tool.name).toBeDefined();
				expect(typeof tool.name).toBe('string');
				expect(tool.description).toBeDefined();
				expect(typeof tool.description).toBe('string');
				expect(tool.category).toBeDefined();
				expect(typeof tool.category).toBe('string');
				expect(typeof tool.throttle_max_calls).toBe('number');
				expect(typeof tool.throttle_window_seconds).toBe('number');
			}
		});
	});
});
