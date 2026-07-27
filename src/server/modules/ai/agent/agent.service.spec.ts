/* Vendor Dependencies */
import {ConfigService} from '@nestjs/config';
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {SchedulerRegistry} from '@nestjs/schedule';
/* Application Dependencies */
import {AiService} from '@server/modules/ai/ai.service';
import {AiMessageRole} from '@server/modules/ai/ai.enums';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
/* Local Dependencies */
import {AgentService} from './agent.service';
import {Agent} from './agent.entity';
import {AgentRun} from './agent-run.entity';
import {AgentKey, AgentRunStatus, AgentToolName} from './agent.enums';
import {AGENTS} from './agent.agents';
import {ToolService} from '@server/modules/ai/tools/tool.service';

describe('AgentService', () => {
	let service: AgentService;

	const mock_agent_repo = {
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockImplementation((dto) => dto),
		save: jest.fn().mockImplementation((entity) => Promise.resolve({id: 'test-uuid', ...entity})),
		update: jest.fn().mockResolvedValue(undefined),
	};

	const mock_run_repo = {
		find: jest.fn().mockResolvedValue([]),
		create: jest.fn().mockImplementation((dto) => dto),
		save: jest.fn().mockImplementation((entity) => Promise.resolve({id: 'run-uuid', ...entity})),
		update: jest.fn().mockResolvedValue(undefined),
		createQueryBuilder: jest.fn().mockReturnValue({
			delete: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue(undefined),
		}),
	};

	const mock_scheduler_registry = {
		doesExist: jest.fn().mockReturnValue(false),
		addCronJob: jest.fn(),
		deleteCronJob: jest.fn(),
		getCronJobs: jest.fn().mockReturnValue(new Map()),
	};

	const mock_ai_service = {
		streamAgent: jest.fn(),
	};

	const mock_tool_executor = {
		getToolSchemas: jest.fn().mockReturnValue([]),
		executeTool: jest.fn().mockResolvedValue({success: true, data: {}}),
		getToolNamesByCategory: jest.fn().mockReturnValue([]),
		getToolNamesExcludingCategory: jest.fn().mockImplementation((tool_names: string[]) => tool_names),
	};

	/** Helper to configure mocks for agents with deliberation (SEND_MESSAGE + SKIP_MESSAGE) */
	const setupDeliberationMocks = () => {
		mock_tool_executor.getToolNamesByCategory.mockReturnValue([AgentToolName.SEND_MESSAGE, AgentToolName.SKIP_MESSAGE]);
		mock_tool_executor.getToolNamesExcludingCategory.mockImplementation((names: string[]) =>
			names.filter((n) => n !== AgentToolName.SEND_MESSAGE && n !== AgentToolName.SKIP_MESSAGE),
		);
	};

	const mock_config_service = {
		get: jest.fn().mockReturnValue(null),
	};
	const mock_mint_metrics_service = {
		isEnabled: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mock_mint_metrics_service.isEnabled.mockReturnValue(true);
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AgentService,
				{provide: getRepositoryToken(Agent), useValue: mock_agent_repo},
				{provide: getRepositoryToken(AgentRun), useValue: mock_run_repo},
				{provide: SchedulerRegistry, useValue: mock_scheduler_registry},
				{provide: AiService, useValue: mock_ai_service},
				{provide: ConfigService, useValue: mock_config_service},
				{provide: ToolService, useValue: mock_tool_executor},
				{provide: MintMetricsService, useValue: mock_mint_metrics_service},
			],
		}).compile();
		service = module.get<AgentService>(AgentService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/* *******************************************************
		executeAgent
	******************************************************** */

	describe('executeAgent', () => {
		const mock_agent: Partial<Agent> = {
			id: 'agent-1',
			agent_key: AgentKey.ACTIVITY_MONITOR,
			name: 'Activity Monitor',
			active: true,
			model: 'test-model',
			system_message: null,
			tools: null,
			schedules: '["10 * * * *"]',
		};

		beforeEach(() => {
			mock_agent_repo.findOne.mockResolvedValue(mock_agent);
			setupDeliberationMocks();
			/* Stream returns a simple text response for both gather and deliberation phases */
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'All systems nominal.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 50, completion_tokens: 20},
				};
			});
		});

		it('should create a run record with RUNNING status', async () => {
			await service.executeAgent('agent-1');

			expect(mock_run_repo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					status: AgentRunStatus.RUNNING,
					agent: mock_agent,
				}),
			);
			expect(mock_run_repo.save).toHaveBeenCalled();
		});

		it('should update agent last_run_status to SUCCESS on completion', async () => {
			await service.executeAgent('agent-1');

			const agent_updates = mock_agent_repo.update.mock.calls;
			const final_update = agent_updates[agent_updates.length - 1];
			expect(final_update[1]).toEqual(expect.objectContaining({last_run_status: AgentRunStatus.SUCCESS}));
		});

		it('should update run to SUCCESS with result and tokens', async () => {
			const result = await service.executeAgent('agent-1');

			expect(result.status).toBe(AgentRunStatus.SUCCESS);
			expect(result.result).toBe('All systems nominal.');
			/* 70 tokens per phase (gather + deliberation) */
			expect(result.tokens_used).toBe(140);
		});

		it('should record schedule_trigger when provided', async () => {
			await service.executeAgent('agent-1', '10 * * * *');

			expect(mock_run_repo.create).toHaveBeenCalledWith(expect.objectContaining({schedule_trigger: '10 * * * *'}));
		});

		it('should throw when agent not found', async () => {
			mock_agent_repo.findOne.mockResolvedValueOnce(null);

			await expect(service.executeAgent('missing-id')).rejects.toThrow('Agent not found: missing-id');
		});

		it('should update run to ERROR when LLM throws', async () => {
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				throw new Error('LLM unavailable');
			});

			await expect(service.executeAgent('agent-1')).rejects.toThrow('LLM unavailable');

			const run_updates = mock_run_repo.update.mock.calls;
			const error_update = run_updates.find((call) => call[1].status === AgentRunStatus.ERROR);
			expect(error_update).toBeDefined();
			expect(error_update[1].error).toBe('LLM unavailable');
		});

		it('should detect notified flag when SEND_MESSAGE is called in deliberation phase', async () => {
			const tool_call_id = 'tc-send-1';
			mock_ai_service.streamAgent
				/* Phase 1: Gather — returns text analysis */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Issues found.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — calls SEND_MESSAGE */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {
							role: AiMessageRole.ASSISTANT,
							content: '',
							tool_calls: [
								{
									id: tool_call_id,
									function: {
										name: AgentToolName.SEND_MESSAGE,
										arguments: {title: 'Alert', body: 'Details', severity: 'warning'},
									},
								},
							],
						},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — final text after tool call */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				});

			mock_tool_executor.executeTool.mockResolvedValueOnce({success: true, data: {delivered: true}});

			const result = await service.executeAgent('agent-1');

			expect(result.notified).toBe(true);
			expect(result.result).toContain('[warning] Alert');
			expect(result.result).toContain('Details');
		});
	});

	/* *******************************************************
		Deliberation
	******************************************************** */

	describe('deliberation', () => {
		const mock_agent_with_message: Partial<Agent> = {
			id: 'agent-delib',
			agent_key: AgentKey.ACTIVITY_MONITOR,
			name: 'Activity Monitor',
			active: true,
			model: 'test-model',
			system_message: null,
			tools: null,
			schedules: '["10 * * * *"]',
		};

		const mock_agent_without_message: Partial<Agent> = {
			id: 'agent-no-delib',
			agent_key: AgentKey.GROUNDSKEEPER,
			name: 'Groundskeeper',
			active: true,
			model: 'test-model',
			system_message: null,
			tools: null,
			schedules: '[]',
		};

		it('should run two phases when agent has message tools', async () => {
			mock_agent_repo.findOne.mockResolvedValue(mock_agent_with_message);
			setupDeliberationMocks();
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Response.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			await service.executeAgent('agent-delib');

			/* streamAgent called twice: once for gather, once for deliberation */
			expect(mock_ai_service.streamAgent).toHaveBeenCalledTimes(2);
		});

		it('should skip deliberation when agent has no message tools', async () => {
			mock_agent_repo.findOne.mockResolvedValue(mock_agent_without_message);
			mock_tool_executor.getToolNamesByCategory.mockReturnValue([]);
			mock_tool_executor.getToolNamesExcludingCategory.mockImplementation((names: string[]) => names);
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Response.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			await service.executeAgent('agent-no-delib');

			/* streamAgent called once: gather only */
			expect(mock_ai_service.streamAgent).toHaveBeenCalledTimes(1);
		});

		it('should extract SKIP_MESSAGE reason as the stored run result', async () => {
			const tool_call_id = 'tc-skip-1';
			mock_agent_repo.findOne.mockResolvedValue(mock_agent_with_message);
			setupDeliberationMocks();
			mock_ai_service.streamAgent
				/* Phase 1: Gather */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Gather analysis.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — calls SKIP_MESSAGE */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {
							role: AiMessageRole.ASSISTANT,
							content: '',
							tool_calls: [
								{
									id: tool_call_id,
									function: {name: AgentToolName.SKIP_MESSAGE, arguments: {reason: 'No changes since last run'}},
								},
							],
						},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — final text after tool call */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				});

			mock_tool_executor.executeTool.mockResolvedValueOnce({
				success: true,
				data: {skipped: true, reason: 'No changes since last run'},
			});

			const run = await service.executeAgent('agent-delib');

			expect(run.result).toBe('No changes since last run');
			expect(run.notified).toBe(false);
		});

		it('should extract SEND_MESSAGE body as the stored run result', async () => {
			const tool_call_id = 'tc-send-1';
			mock_agent_repo.findOne.mockResolvedValue(mock_agent_with_message);
			setupDeliberationMocks();
			mock_ai_service.streamAgent
				/* Phase 1: Gather */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Gather analysis.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — calls SEND_MESSAGE */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {
							role: AiMessageRole.ASSISTANT,
							content: '',
							tool_calls: [
								{
									id: tool_call_id,
									function: {
										name: AgentToolName.SEND_MESSAGE,
										arguments: {title: 'Memory High', body: 'Memory at 96%', severity: 'warning'},
									},
								},
							],
						},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				})
				/* Phase 2: Deliberation — final text after tool call */
				.mockImplementationOnce(async function* () {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				});

			mock_tool_executor.executeTool.mockResolvedValueOnce({success: true, data: {delivered: true}});

			const run = await service.executeAgent('agent-delib');

			expect(run.result).toBe('[warning] Memory High\nMemory at 96%');
			expect(run.notified).toBe(true);
		});

		it('should set notified to false when deliberation produces no tool call', async () => {
			mock_agent_repo.findOne.mockResolvedValue(mock_agent_with_message);
			setupDeliberationMocks();
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'All clear.'},
					done: true,
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			const run = await service.executeAgent('agent-delib');

			expect(run.notified).toBe(false);
		});
	});

	/* *******************************************************
		runToolLoop
	******************************************************** */

	describe('runToolLoop', () => {
		it('should return result when LLM responds with content (no tool calls)', async () => {
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Hello!'},
					done: true,
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			const result = await service.runToolLoop({
				model: 'test-model',
				messages: [
					{role: AiMessageRole.SYSTEM, content: 'sys'},
					{role: AiMessageRole.USER, content: 'hi'},
				],
				tool_names: [],
				agent_context: {agent_id: 'a1', agent_name: 'Test'},
			});

			expect(result.result).toBe('Hello!');
			expect(result.tokens_used).toBe(15);
		});

		it('should execute tool calls and iterate until content response', async () => {
			let call_count = 0;
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				call_count++;
				if (call_count === 1) {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {
							role: AiMessageRole.ASSISTANT,
							content: '',
							tool_calls: [{id: 'tc-1', function: {name: 'GET_SYSTEM_METRICS', arguments: {}}}],
						},
						done: true,
						usage: {prompt_tokens: 10, completion_tokens: 5},
					};
				} else {
					yield {
						model: 'test-model',
						created_at: new Date().toISOString(),
						message: {role: AiMessageRole.ASSISTANT, content: 'CPU is fine.'},
						done: true,
						usage: {prompt_tokens: 20, completion_tokens: 10},
					};
				}
			});

			mock_tool_executor.executeTool.mockResolvedValueOnce({cpu: 0.5});

			const result = await service.runToolLoop({
				model: 'test-model',
				messages: [
					{role: AiMessageRole.SYSTEM, content: 'sys'},
					{role: AiMessageRole.USER, content: 'check cpu'},
				],
				tool_names: ['GET_SYSTEM_METRICS'],
				agent_context: {agent_id: 'a1', agent_name: 'Test'},
			});

			expect(mock_tool_executor.executeTool).toHaveBeenCalledWith('GET_SYSTEM_METRICS', {}, {agent_id: 'a1', agent_name: 'Test'});
			expect(result.result).toBe('CPU is fine.');
			expect(result.tokens_used).toBe(45);
		});

		it('should respect abort signal', async () => {
			const controller = new AbortController();
			controller.abort();

			const result = await service.runToolLoop({
				model: 'test-model',
				messages: [{role: AiMessageRole.USER, content: 'hi'}],
				tool_names: [],
				agent_context: {agent_id: 'a1', agent_name: 'Test'},
				signal: controller.signal,
			});

			expect(result.result).toBe('');
			expect(mock_ai_service.streamAgent).not.toHaveBeenCalled();
		});

		it('should return max-iterations message when cap is reached', async () => {
			/* Always return tool calls to exhaust the loop */
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {
						role: AiMessageRole.ASSISTANT,
						content: '',
						tool_calls: [{id: `tc-${Date.now()}`, function: {name: 'GET_SYSTEM_METRICS', arguments: {}}}],
					},
					done: true,
					usage: {prompt_tokens: 1, completion_tokens: 1},
				};
			});

			const result = await service.runToolLoop({
				model: 'test-model',
				messages: [{role: AiMessageRole.USER, content: 'loop'}],
				tool_names: ['GET_SYSTEM_METRICS'],
				agent_context: {agent_id: 'a1', agent_name: 'Test'},
			});

			expect(result.result).toContain('maximum tool iterations');
			expect(mock_ai_service.streamAgent).toHaveBeenCalledTimes(25);
		}, 15000);

		it('should respect custom max_iterations parameter', async () => {
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {
						role: AiMessageRole.ASSISTANT,
						content: '',
						tool_calls: [{id: `tc-${Date.now()}`, function: {name: 'GET_SYSTEM_METRICS', arguments: {}}}],
					},
					done: true,
					usage: {prompt_tokens: 1, completion_tokens: 1},
				};
			});

			const result = await service.runToolLoop({
				model: 'test-model',
				messages: [{role: AiMessageRole.USER, content: 'loop'}],
				tool_names: ['GET_SYSTEM_METRICS'],
				agent_context: {agent_id: 'a1', agent_name: 'Test'},
				max_iterations: 3,
			});

			expect(result.result).toContain('maximum tool iterations');
			expect(mock_ai_service.streamAgent).toHaveBeenCalledTimes(3);
		});
	});

	/* *******************************************************
		Execution Queue
	******************************************************** */

	describe('enqueueAgent', () => {
		const mock_agents: Record<string, Partial<Agent>> = {
			'agent-1': {
				id: 'agent-1',
				agent_key: AgentKey.ACTIVITY_MONITOR,
				name: 'Agent 1',
				active: true,
				model: 'test-model',
				system_message: null,
				tools: null,
				schedules: '["10 * * * *"]',
			},
			'agent-2': {
				id: 'agent-2',
				agent_key: AgentKey.GROUNDSKEEPER,
				name: 'Agent 2',
				active: true,
				model: 'test-model',
				system_message: null,
				tools: null,
				schedules: '["10 * * * *"]',
			},
			'agent-3': {
				id: 'agent-3',
				agent_key: AgentKey.GROUNDSKEEPER,
				name: 'Agent 3',
				active: true,
				model: 'test-model',
				system_message: null,
				tools: null,
				schedules: '["10 * * * *"]',
			},
		};

		beforeEach(() => {
			mock_agent_repo.findOne.mockImplementation((opts: any) => {
				return Promise.resolve(mock_agents[opts.where.id] ?? null);
			});
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});
		});

		it('should execute multiple agents sequentially', async () => {
			const execution_order: string[] = [];
			mock_agent_repo.findOne.mockImplementation((opts: any) => {
				execution_order.push(opts.where.id);
				return Promise.resolve(mock_agents[opts.where.id] ?? null);
			});

			await Promise.all([
				(service as any).enqueueAgent('agent-1', '10 * * * *'),
				(service as any).enqueueAgent('agent-2', '10 * * * *'),
				(service as any).enqueueAgent('agent-3', '10 * * * *'),
			]);

			expect(execution_order).toEqual(['agent-1', 'agent-2', 'agent-3']);
		});

		it('should skip duplicate agent already in the queue', async () => {
			let resolve_first: () => void;
			const block = new Promise<void>((r) => (resolve_first = r));
			let call_count = 0;

			mock_ai_service.streamAgent.mockImplementation(async function* () {
				call_count++;
				if (call_count === 1) await block;
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			const first = (service as any).enqueueAgent('agent-1', '10 * * * *');
			const duplicate = (service as any).enqueueAgent('agent-1', '10 * * * *');

			resolve_first!();
			await Promise.all([first, duplicate]);

			/* executeAgent should only have been called once for agent-1 */
			const find_calls = mock_agent_repo.findOne.mock.calls.filter((c: any) => c[0].where.id === 'agent-1');
			expect(find_calls).toHaveLength(1);
		});

		it('should continue queue when an agent errors', async () => {
			let call_count = 0;
			mock_ai_service.streamAgent.mockImplementation(async function* () {
				call_count++;
				if (call_count === 1) throw new Error('LLM down');
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			const results = await Promise.allSettled([
				(service as any).enqueueAgent('agent-1', '10 * * * *'),
				(service as any).enqueueAgent('agent-2', '10 * * * *'),
			]);

			expect(results[0].status).toBe('rejected');
			expect(results[1].status).toBe('fulfilled');
		});

		it('should drop runs when queue depth is exceeded', async () => {
			let resolve_block: () => void;
			const block = new Promise<void>((r) => (resolve_block = r));

			mock_ai_service.streamAgent.mockImplementation(async function* () {
				await block;
				yield {
					model: 'test-model',
					created_at: new Date().toISOString(),
					message: {role: AiMessageRole.ASSISTANT, content: 'Done.'},
					done: true,
					done_reason: 'stop',
					usage: {prompt_tokens: 10, completion_tokens: 5},
				};
			});

			/* Fill the queue beyond MAX_QUEUE_DEPTH (10) with unique agent ids */
			const agents: Record<string, Partial<Agent>> = {};
			const promises: Promise<void>[] = [];
			for (let i = 0; i < 12; i++) {
				const id = `agent-q-${i}`;
				agents[id] = {
					id,
					agent_key: AgentKey.GROUNDSKEEPER,
					name: `Agent ${i}`,
					active: true,
					model: 'test-model',
					system_message: null,
					tools: null,
					schedules: '[]',
				};
			}
			mock_agent_repo.findOne.mockImplementation((opts: any) => Promise.resolve(agents[opts.where.id] ?? null));

			for (let i = 0; i < 12; i++) {
				promises.push((service as any).enqueueAgent(`agent-q-${i}`, '10 * * * *'));
			}

			/* The 11th and 12th should have been dropped */
			expect((service as any).queue_depth).toBe(10);

			resolve_block!();
			await Promise.allSettled(promises);
		});
	});

	/* *******************************************************
		Scheduling
	******************************************************** */

	describe('syncAgentSchedules', () => {
		beforeEach(() => jest.useFakeTimers());
		afterEach(() => jest.useRealTimers());

		it('should register cron jobs for active agent with valid schedules', async () => {
			const agent = {id: 'agent-1', active: true, schedules: '["10 * * * *"]'} as Agent;

			await service.syncAgentSchedules(agent);

			expect(mock_scheduler_registry.addCronJob).toHaveBeenCalled();
		});

		it('should remove existing jobs and not register new ones for inactive agent', async () => {
			const jobs = new Map<string, any>([['agent:agent-1:10 * * * *', {stop: jest.fn()}]]);
			mock_scheduler_registry.getCronJobs.mockReturnValueOnce(jobs);

			const agent = {id: 'agent-1', active: false, schedules: '["10 * * * *"]'} as Agent;

			await service.syncAgentSchedules(agent);

			expect(mock_scheduler_registry.deleteCronJob).toHaveBeenCalledWith('agent:agent-1:10 * * * *');
			expect(mock_scheduler_registry.addCronJob).not.toHaveBeenCalled();
		});

		it('should not duplicate an existing cron job', async () => {
			mock_scheduler_registry.doesExist.mockReturnValueOnce(true);

			const agent = {id: 'agent-1', active: true, schedules: '["10 * * * *"]'} as Agent;

			await service.syncAgentSchedules(agent);

			expect(mock_scheduler_registry.addCronJob).not.toHaveBeenCalled();
		});
	});

	/* *******************************************************
		Agent Resolution Helpers
	******************************************************** */

	describe('resolveToolNames', () => {
		it('should return parsed tools when agent has custom tools', () => {
			const agent = {agent_key: AgentKey.GROUNDSKEEPER, tools: '["GET_MINT_INFO"]'} as Agent;

			expect(service.resolveToolNames(agent)).toEqual(['GET_MINT_INFO']);
		});

		it('should fall back to built-in tools when agent.tools is null', () => {
			const agent = {agent_key: AgentKey.GROUNDSKEEPER, tools: null} as Agent;

			expect(service.resolveToolNames(agent)).toEqual(AGENTS[AgentKey.GROUNDSKEEPER].tools);
		});

		it('should return empty array for non-built-in agent with no tools', () => {
			const agent = {agent_key: null, tools: null} as Agent;

			expect(service.resolveToolNames(agent)).toEqual([]);
		});
	});

	describe('buildSystemMessage', () => {
		it('should use custom system_message when set', () => {
			const agent = {agent_key: AgentKey.GROUNDSKEEPER, system_message: 'Custom prompt', schedules: '[]'} as Agent;

			const result = service.buildSystemMessage(agent);

			expect(result).toContain('Custom prompt');
			expect(result).toContain('[Runtime Context]');
		});

		it('should fall back to built-in system_message when agent has none', () => {
			const agent = {agent_key: AgentKey.GROUNDSKEEPER, system_message: null, schedules: '[]'} as Agent;

			const result = service.buildSystemMessage(agent);

			expect(result).toContain('Groundskeeper');
			expect(result).toContain('[Runtime Context]');
		});
	});

	describe('buildRuntimeContext', () => {
		it('should include configured services', () => {
			mock_config_service.get.mockImplementation((key: string) => {
				if (key === 'bitcoin.type') return 'bitcoind';
				if (key === 'lightning.type') return 'lnd';
				if (key === 'cashu.type') return 'cdk';
				return null;
			});

			const agent = {id: 'agent-1', name: 'Test', schedules: '[]'} as Agent;
			const result = service.buildRuntimeContext(agent);

			expect(result).toContain('bitcoin (bitcoind)');
			expect(result).toContain('lightning (lnd)');
			expect(result).toContain('mint (cdk)');
			expect(result).toContain('Mint metrics: enabled');
		});

		it('should identify mint metrics as disabled without an exporter endpoint', () => {
			mock_mint_metrics_service.isEnabled.mockReturnValue(false);
			mock_config_service.get.mockImplementation((key: string) => {
				if (key === 'cashu.type') return 'cdk';
				return null;
			});

			const agent = {id: 'agent-1', name: 'Test', schedules: '[]'} as Agent;
			const result = service.buildRuntimeContext(agent);

			expect(result).toContain('Mint metrics: disabled');
		});

		it('should show on-demand only when no schedules', () => {
			const agent = {id: 'agent-1', name: 'Test', schedules: '[]'} as Agent;

			const result = service.buildRuntimeContext(agent);

			expect(result).toContain('on-demand only');
		});

		it('should describe schedule cadence', () => {
			const agent = {id: 'agent-1', name: 'Test', schedules: '["10 * * * *"]'} as Agent;

			const result = service.buildRuntimeContext(agent);

			expect(result).toContain('every hour');
		});
	});

	/* *******************************************************
		Data Access
	******************************************************** */

	describe('getAgents', () => {
		it('should return agents ordered by created_at', async () => {
			await service.getAgents();

			expect(mock_agent_repo.find).toHaveBeenCalledWith({order: {created_at: 'ASC'}});
		});
	});

	describe('getAgentRuns', () => {
		it('should paginate and filter by notified', async () => {
			await service.getAgentRuns({agent_id: 'agent-1', page: 1, page_size: 10, notified: true});

			expect(mock_run_repo.find).toHaveBeenCalledWith({
				where: {agent: {id: 'agent-1'}, notified: true},
				order: {started_at: 'DESC'},
				skip: 10,
				take: 10,
			});
		});
	});

	describe('updateAgent', () => {
		it('should validate cron expressions on update', async () => {
			mock_agent_repo.findOne.mockResolvedValueOnce({id: 'agent-1', active: true, schedules: '[]'} as Agent);

			await expect(service.updateAgent('agent-1', {schedules: '["* * * * *"]'})).rejects.toThrow('Minimum allowed interval');
		});

		it('should save updated fields and sync schedules', async () => {
			mock_agent_repo.findOne.mockResolvedValueOnce({id: 'agent-1', active: true, schedules: '[]'} as Agent);

			await service.updateAgent('agent-1', {name: 'Renamed Agent'});

			expect(mock_agent_repo.save).toHaveBeenCalledWith(expect.objectContaining({name: 'Renamed Agent'}));
		});
	});

	/* *******************************************************
		Cleanup
	******************************************************** */

	describe('cleanupOldRuns', () => {
		it('should delete runs older than the 100th most recent', async () => {
			const agent = {id: 'agent-1', name: 'Test'};
			mock_agent_repo.find.mockResolvedValueOnce([agent]);
			mock_run_repo.find.mockResolvedValueOnce([{started_at: 1000}]);

			await service.cleanupOldRuns();

			const qb = mock_run_repo.createQueryBuilder();
			expect(qb.delete).toHaveBeenCalled();
			expect(qb.where).toHaveBeenCalledWith('agent_id = :agent_id AND started_at <= :cutoff', {
				agent_id: 'agent-1',
				cutoff: 1000,
			});
		});

		it('should skip agents with fewer than 100 runs', async () => {
			const agent = {id: 'agent-2', name: 'Test'};
			mock_agent_repo.find.mockResolvedValueOnce([agent]);
			mock_run_repo.find.mockResolvedValueOnce([]);

			await service.cleanupOldRuns();

			expect(mock_run_repo.createQueryBuilder).not.toHaveBeenCalled();
		});
	});
});
