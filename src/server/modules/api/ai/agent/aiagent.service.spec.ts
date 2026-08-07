/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {AgentService} from '@server/modules/ai/agent/agent.service';
/* Local Dependencies */
import {AiAgentService} from './aiagent.service.js';

const mock_agent = {
	id: 'test-uuid',
	agent_key: 'ACTIVITY_MONITOR',
	name: 'Activity Monitor',
	description: 'Test description',
	active: false,
	system_message: null,
	tools: '[]',
	schedules: '["10 * * * *"]',
	last_run_at: null,
	last_run_status: null,
	created_at: 1700000000,
	updated_at: 1700000000,
};

const mock_run = {
	id: 'run-uuid',
	status: 'success',
	schedule_trigger: null,
	started_at: 1700000000,
	completed_at: 1700000001,
	result: 'Agent executed (stub)',
	error: null,
	tokens_used: null,
};

describe('AiAgentService', () => {
	let aiAgentService: AiAgentService;
	let agentService: jest.Mocked<AgentService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiAgentService,
				{
					provide: AgentService,
					useValue: {
						getAgents: jest.fn().mockResolvedValue([mock_agent]),
						getAgent: jest.fn().mockResolvedValue(mock_agent),
						getAgentRuns: jest.fn().mockResolvedValue([mock_run]),
						updateAgent: jest.fn().mockResolvedValue(mock_agent),
						executeAgent: jest.fn().mockResolvedValue(mock_run),
					},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		aiAgentService = module.get<AiAgentService>(AiAgentService);
		agentService = module.get(AgentService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(aiAgentService).toBeDefined();
	});

	it('returns all agents', async () => {
		const agents = await aiAgentService.getAgents('TAG');
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe('Activity Monitor');
		expect(agents[0].schedules).toEqual(['10 * * * *']);
	});

	it('returns a single agent', async () => {
		const agent = await aiAgentService.getAgent('TAG', 'test-uuid');
		expect(agent.id).toBe('test-uuid');
	});

	it('throws OrchardApiError when agent not found', async () => {
		agentService.getAgent.mockResolvedValue(null);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AgentNotFoundError});
		await expect(aiAgentService.getAgent('TAG', 'missing')).rejects.toBeInstanceOf(OrchardApiError);
	});

	it('returns agent runs', async () => {
		const runs = await aiAgentService.getAgentRuns('TAG', {agent_id: 'test-uuid'});
		expect(runs).toHaveLength(1);
		expect(runs[0].result).toBe('Agent executed (stub)');
	});

	it('executes an agent', async () => {
		const run = await aiAgentService.executeAgent('TAG', 'test-uuid');
		expect(run.status).toBe('success');
		expect(agentService.executeAgent).toHaveBeenCalledWith('test-uuid');
	});

	it('serializes tools and schedules on update', async () => {
		await aiAgentService.updateAgent('TAG', 'test-uuid', {tools: ['tool1'], schedules: ['0 * * * *']});
		expect(agentService.updateAgent).toHaveBeenCalledWith('test-uuid', {
			tools: '["tool1"]',
			schedules: '["0 * * * *"]',
		});
	});
});
