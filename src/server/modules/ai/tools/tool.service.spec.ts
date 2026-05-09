/* Vendor Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {GraphQLSchemaHost} from '@nestjs/graphql';
import {makeExecutableSchema} from '@graphql-tools/schema';
/* Application Dependencies */
import {AgentToolCategory, AgentToolName} from '@server/modules/ai/agent/agent.enums';
/* Local Dependencies */
import {ToolService} from './tool.service';

const mock_schema = makeExecutableSchema({
	typeDefs: `
		scalar UnixTimestamp
		scalar Timezone

		enum AnalyticsInterval { hour day week month custom }
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
		},
	},
});

describe('ToolService', () => {
	let service: ToolService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ToolService, {provide: GraphQLSchemaHost, useValue: {schema: mock_schema}}],
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
