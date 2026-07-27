/* Vendor Dependencies */
import {ConfigService} from '@nestjs/config';
import {Test, TestingModule} from '@nestjs/testing';
import {GraphQLSchemaHost} from '@nestjs/graphql';
import {makeExecutableSchema} from '@graphql-tools/schema';
/* Application Dependencies */
import {AgentToolCategory, AgentToolName} from '@server/modules/ai/agent/agent.enums';
/* Local Dependencies */
import {ToolService} from './tool.service';

const mock_mint_metrics_resolver = jest.fn().mockReturnValue([
	{
		metric: 'cdk_errors_total',
		labels: [{name: 'kind', value: 'payment'}],
		type: 'counter',
		date: 1700000000,
		value: 2,
		min: null,
		max: null,
		count: null,
		p50: null,
		p95: null,
		p99: null,
	},
]);

const mock_schema = makeExecutableSchema({
	typeDefs: `
		scalar UnixTimestamp
		scalar Timezone

		enum AnalyticsInterval { hour day week month custom }
		enum SystemMetricsInterval { minute hour day }
		enum MintMetricType { gauge counter histogram }
		enum LightningAnalyticsMetric {
			payments_out payments_failed payments_pending
			invoices_in forward_fees
			channel_opens channel_closes
			channel_opens_remote channel_closes_remote
		}
		enum MintUnit { sat msat usd eur btc }
		enum MintAnalyticsMetric {
			mints_amount mints_created mints_completion_time
			melts_amount melts_created melts_completion_time
			swaps_amount
			issued_amount redeemed_amount fees_amount
			keyset_issued keyset_redeemed
		}

		type Query {
			lightning_analytics_local_balance(
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval,
				timezone: Timezone
			): [LightningAnalytics!]!
			lightning_analytics_remote_balance(
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval,
				timezone: Timezone
			): [LightningAnalytics!]!
			lightning_analytics_metrics(
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval,
				timezone: Timezone,
				metrics: [LightningAnalyticsMetric!]
			): [LightningAnalyticsMetric_Type!]!
			mint_analytics_balances(
				units: [MintUnit!],
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval
			): [MintAnalytics!]!
			mint_analytics_mints(
				units: [MintUnit!],
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval
			): [MintAnalytics!]!
			mint_analytics_melts(
				units: [MintUnit!],
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval
			): [MintAnalytics!]!
			mint_analytics_fees(
				units: [MintUnit!],
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval
			): [MintAnalytics!]!
			mint_analytics_metrics(
				units: [MintUnit!],
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: AnalyticsInterval,
				metrics: [MintAnalyticsMetric!]
			): [MintAnalyticsMetric_Type!]!
			mint_metrics(
				date_start: UnixTimestamp,
				date_end: UnixTimestamp,
				interval: SystemMetricsInterval,
				timezone: Timezone,
				metrics: [String!]
			): [MintMetrics!]!
		}

		type LightningAnalytics {
			unit: String!
			amount: String!
			date: Int!
		}

		type LightningAnalyticsMetric_Type {
			unit: String!
			metric: String!
			amount: String!
			date: Int!
			count: Int
		}

		type MintAnalytics {
			unit: String!
			amount: String!
			date: Int!
			count: Int
		}

		type MintAnalyticsMetric_Type {
			unit: String!
			metric: String!
			amount: String!
			date: Int!
			count: Int
		}

		type MintMetricLabel {
			name: String!
			value: String!
		}

		type MintMetrics {
			metric: String!
			labels: [MintMetricLabel!]!
			type: MintMetricType!
			date: UnixTimestamp!
			value: Float
			min: Float
			max: Float
			count: Float
			p50: Float
			p95: Float
			p99: Float
		}
	`,
	resolvers: {
		Query: {
			lightning_analytics_local_balance: () => [{unit: 'msat', amount: '1000', date: 1700000000}],
			lightning_analytics_remote_balance: () => [{unit: 'msat', amount: '500', date: 1700000000}],
			lightning_analytics_metrics: () => [{unit: 'msat', metric: 'invoices_in', amount: '1000', date: 1700000000, count: 1}],
			mint_analytics_balances: () => [{unit: 'sat', amount: '5000', date: 1700000000, count: 10}],
			mint_analytics_mints: () => [{unit: 'sat', amount: '3000', date: 1700000000, count: 5}],
			mint_analytics_melts: () => [{unit: 'sat', amount: '2000', date: 1700000000, count: 3}],
			mint_analytics_fees: () => [{unit: 'sat', amount: '100', date: 1700000000, count: 8}],
			mint_analytics_metrics: () => [{unit: 'sat', metric: 'mints_amount', amount: '3000', date: 1700000000, count: 5}],
			mint_metrics: mock_mint_metrics_resolver,
		},
	},
});

describe('ToolService', () => {
	let service: ToolService;
	const mock_config_service = {
		get: jest.fn(),
	};

	beforeEach(async () => {
		mock_config_service.get.mockImplementation((key: string) => {
			if (key === 'cashu.type') return 'cdk';
			if (key === 'cashu.metrics_api') return 'http://mint:9090';
			return null;
		});
		mock_mint_metrics_resolver.mockClear();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ToolService,
				{provide: GraphQLSchemaHost, useValue: {schema: mock_schema}},
				{provide: ConfigService, useValue: mock_config_service},
			],
		}).compile();
		service = module.get<ToolService>(ToolService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getToolSchemas', () => {
		it('returns schemas for registered tools', () => {
			const schemas = service.getToolSchemas([AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES]);
			expect(schemas.length).toEqual(1);
			expect(schemas[0].function.name).toBe(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES);
		});

		it('returns empty array for unknown tool names', () => {
			const schemas = service.getToolSchemas(['UNKNOWN_TOOL']);
			expect(schemas.length).toEqual(0);
		});

		it('filters out unknown names from mixed input', () => {
			const schemas = service.getToolSchemas([AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, 'UNKNOWN']);
			expect(schemas.length).toEqual(1);
		});
	});

	describe('getRegisteredTools', () => {
		it('returns all registered tool names', () => {
			const tools = service.getRegisteredTools();
			expect(tools).toContain(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES);
			expect(tools).toContain(AgentToolName.GET_LIGHTNING_ANALYTICS_METRICS);
			expect(tools).toContain(AgentToolName.GET_MINT_ANALYTICS);
			expect(tools).toContain(AgentToolName.GET_MINT_ANALYTICS_METRICS);
			expect(tools).toContain(AgentToolName.GET_MINT_METRICS);
		});
	});

	describe('executeTool', () => {
		it('returns error for unknown tool', async () => {
			const result = await service.executeTool('FAKE_TOOL', {});
			expect(result.success).toBe(false);
			expect(result.error).toContain('Unknown tool');
		});

		it('executes a GraphQL-backed tool', async () => {
			const result = await service.executeTool(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, {});
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
		});

		it('executes the mint analytics metrics tool', async () => {
			const result = await service.executeTool(AgentToolName.GET_MINT_ANALYTICS_METRICS, {});
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
		});

		it('executes the stored mint metrics tool with bounded variables', async () => {
			const args = {
				date_start: 1700000000,
				date_end: 1700003600,
				interval: 'hour',
				timezone: 'UTC',
				metrics: ['cdk_errors_total'],
			};

			const result = await service.executeTool(AgentToolName.GET_MINT_METRICS, args);

			expect(result.success).toBe(true);
			expect(result.data).toEqual({
				mint_metrics: [
					expect.objectContaining({
						metric: 'cdk_errors_total',
						labels: [{name: 'kind', value: 'payment'}],
						type: 'counter',
						value: 2,
					}),
				],
			});
			expect(mock_mint_metrics_resolver).toHaveBeenCalledWith(undefined, args, expect.anything(), expect.anything());
		});

		it('rejects mint metrics when the mint backend is not CDK', async () => {
			mock_config_service.get.mockImplementation((key: string) => (key === 'cashu.type' ? 'nutshell' : null));

			const result = await service.executeTool(AgentToolName.GET_MINT_METRICS, {
				date_start: 1700000000,
				interval: 'hour',
				metrics: ['cdk_errors_total'],
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('MINT_TYPE=cdk');
			expect(mock_mint_metrics_resolver).not.toHaveBeenCalled();
		});

		it('rejects mint metrics when the exporter endpoint is not configured', async () => {
			mock_config_service.get.mockImplementation((key: string) => (key === 'cashu.type' ? 'cdk' : null));

			const result = await service.executeTool(AgentToolName.GET_MINT_METRICS, {
				date_start: 1700000000,
				interval: 'hour',
				metrics: ['cdk_errors_total'],
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('MINT_METRICS_API');
			expect(mock_mint_metrics_resolver).not.toHaveBeenCalled();
		});

		it('rejects mint metrics queries that exceed the response budget', async () => {
			const result = await service.executeTool(AgentToolName.GET_MINT_METRICS, {
				date_start: 1700000000,
				date_end: 1700086400,
				interval: 'minute',
				metrics: ['cdk_errors_total'],
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('max 500');
			expect(mock_mint_metrics_resolver).not.toHaveBeenCalled();
		});

		it('rejects mint metrics queries without explicit metric families', async () => {
			const result = await service.executeTool(AgentToolName.GET_MINT_METRICS, {
				date_start: 1700000000,
				date_end: 1700003600,
				interval: 'hour',
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('explicit metric family');
			expect(mock_mint_metrics_resolver).not.toHaveBeenCalled();
		});
	});

	describe('getToolNamesByCategory', () => {
		it('returns only tools matching the given category', () => {
			const all_tools = [
				AgentToolName.GET_LIGHTNING_INFO,
				AgentToolName.SEND_MESSAGE,
				AgentToolName.SKIP_MESSAGE,
				AgentToolName.GET_MINT_INFO,
			];
			const result = service.getToolNamesByCategory(all_tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual([AgentToolName.SEND_MESSAGE, AgentToolName.SKIP_MESSAGE]);
		});

		it('returns empty array when no tools match', () => {
			const tools = [AgentToolName.GET_LIGHTNING_INFO, AgentToolName.GET_MINT_INFO];
			const result = service.getToolNamesByCategory(tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual([]);
		});

		it('ignores unknown tool names', () => {
			const tools = ['UNKNOWN_TOOL', AgentToolName.SEND_MESSAGE];
			const result = service.getToolNamesByCategory(tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual([AgentToolName.SEND_MESSAGE]);
		});
	});

	describe('getToolNamesExcludingCategory', () => {
		it('returns tools not matching the given category', () => {
			const all_tools = [
				AgentToolName.GET_LIGHTNING_INFO,
				AgentToolName.SEND_MESSAGE,
				AgentToolName.SKIP_MESSAGE,
				AgentToolName.GET_MINT_INFO,
			];
			const result = service.getToolNamesExcludingCategory(all_tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual([AgentToolName.GET_LIGHTNING_INFO, AgentToolName.GET_MINT_INFO]);
		});

		it('returns all tools when none match the excluded category', () => {
			const tools = [AgentToolName.GET_LIGHTNING_INFO, AgentToolName.GET_MINT_INFO];
			const result = service.getToolNamesExcludingCategory(tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual(tools);
		});

		it('excludes unknown tool names (category is undefined)', () => {
			const tools = ['UNKNOWN_TOOL', AgentToolName.GET_MINT_INFO];
			const result = service.getToolNamesExcludingCategory(tools, AgentToolCategory.MESSAGE);
			expect(result).toEqual(tools);
		});
	});

	describe('throttling', () => {
		it('allows calls within the bucket limit', async () => {
			for (let i = 0; i < 5; i++) {
				const result = await service.executeTool(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, {});
				expect(result.success).toBe(true);
			}
		});

		it('throttles when bucket limit is exceeded', async () => {
			/* Lightning analytics allows 15 calls per 60s — fill the bucket */
			for (let i = 0; i < 15; i++) {
				await service.executeTool(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, {});
			}
			const result = await service.executeTool(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, {});
			expect(result.success).toBe(false);
			expect(result.error).toContain('throttled');
		});
	});
});
