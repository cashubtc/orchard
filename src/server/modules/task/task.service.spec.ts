/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {AuthService} from '@server/modules/auth/auth.service';
import {SettingService} from '@server/modules/setting/setting.service';
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {BitcoinUTXOracleService} from '@server/modules/bitcoin/utxoracle/utxoracle.service';
import {LightningAnalyticsService} from '@server/modules/lightning/analytics/lnanalytics.service';
import {BitcoinAnalyticsService} from '@server/modules/bitcoin/analytics/btcanalytics.service';
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {AgentService} from '@server/modules/ai/agent/agent.service';
import {ConversationService} from '@server/modules/ai/conversation/conversation.service';
import {SystemMetricsService} from '@server/modules/system/metrics/sysmetrics.service';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
/* Local Dependencies */
import {TaskService} from './task.service';

describe('TaskService', () => {
	let taskService: TaskService;
	let authService: jest.Mocked<AuthService>;
	let configService: jest.Mocked<ConfigService>;
	let mintMetricsService: jest.Mocked<MintMetricsService>;
	let logger_spy: jest.SpyInstance;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TaskService,
				{
					provide: AuthService,
					useValue: {
						cleanupExpiredTokens: jest.fn(),
					},
				},
				{
					provide: SettingService,
					useValue: {
						getSetting: jest.fn(),
						getBooleanSetting: jest.fn(),
						getStringSetting: jest.fn(),
						getNumberSetting: jest.fn(),
					},
				},
				{
					provide: BitcoinRpcService,
					useValue: {
						getBitcoinBlockchainInfo: jest.fn(),
					},
				},
				{
					provide: BitcoinUTXOracleService,
					useValue: {
						runOracle: jest.fn(),
						saveOraclePrice: jest.fn(),
					},
				},
				{
					provide: LightningAnalyticsService,
					useValue: {
						runStreamingBackfill: jest.fn(),
						rescanRecentRecords: jest.fn(),
					},
				},
				{
					provide: BitcoinAnalyticsService,
					useValue: {
						runStreamingBackfill: jest.fn(),
						rescanRecentRecords: jest.fn(),
					},
				},
				{
					provide: CashuMintAnalyticsService,
					useValue: {
						runBackfill: jest.fn(),
						rescanRecentRecords: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn(),
					},
				},
				{
					provide: AgentService,
					useValue: {
						cleanupOldRuns: jest.fn(),
					},
				},
				{
					provide: ConversationService,
					useValue: {
						cleanupExpiredConversations: jest.fn(),
					},
				},
				{
					provide: SystemMetricsService,
					useValue: {
						collectAndStore: jest.fn(),
						cleanupOldMetrics: jest.fn(),
					},
				},
				{
					provide: MintMetricsService,
					useValue: {
						collectAndStore: jest.fn(),
						cleanupOldMetrics: jest.fn(),
					},
				},
			],
		}).compile();

		taskService = module.get<TaskService>(TaskService);
		authService = module.get(AuthService);
		configService = module.get(ConfigService);
		mintMetricsService = module.get(MintMetricsService);

		// Spy on logger methods
		logger_spy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
		jest.spyOn(Logger.prototype, 'error').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(taskService).toBeDefined();
	});

	describe('cleanupExpiredTokens', () => {
		it('should cleanup tokens and log success', async () => {
			// Arrange
			const expected_count = 42;
			authService.cleanupExpiredTokens.mockResolvedValue(expected_count);

			// Act
			await taskService.cleanupExpiredTokens();

			// Assert
			expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
			expect(logger_spy).toHaveBeenCalledWith('Starting expired token cleanup...');
			expect(logger_spy).toHaveBeenCalledWith(`Cleaned up ${expected_count} expired tokens`);
		});

		it('should log zero when no tokens are cleaned up', async () => {
			// Arrange
			authService.cleanupExpiredTokens.mockResolvedValue(0);

			// Act
			await taskService.cleanupExpiredTokens();

			// Assert
			expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
			expect(logger_spy).toHaveBeenCalledWith('Cleaned up 0 expired tokens');
		});

		it('should log error when cleanup fails', async () => {
			// Arrange
			const error = new Error('Database connection failed');
			authService.cleanupExpiredTokens.mockRejectedValue(error);
			const error_spy = jest.spyOn(Logger.prototype, 'error');

			// Act
			await taskService.cleanupExpiredTokens();

			// Assert
			expect(authService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
			expect(error_spy).toHaveBeenCalledWith('Error cleaning up tokens: Database connection failed');
		});
	});

	describe('collectMintMetrics', () => {
		it('should skip when mint type is not cdk', async () => {
			configService.get.mockReturnValue('nutshell');

			await taskService.collectMintMetrics();

			expect(mintMetricsService.collectAndStore).not.toHaveBeenCalled();
		});

		it('should skip when the metrics endpoint env config is unset', async () => {
			configService.get.mockImplementation((key: string) => (key === 'cashu.type' ? 'cdk' : undefined));

			await taskService.collectMintMetrics();

			expect(mintMetricsService.collectAndStore).not.toHaveBeenCalled();
		});

		it('should collect for cdk mints with a metrics endpoint configured', async () => {
			configService.get.mockReturnValue('cdk');
			mintMetricsService.collectAndStore.mockResolvedValue();

			await taskService.collectMintMetrics();

			expect(mintMetricsService.collectAndStore).toHaveBeenCalledTimes(1);
		});

		it('should log errors without throwing', async () => {
			configService.get.mockReturnValue('cdk');
			mintMetricsService.collectAndStore.mockRejectedValue(new Error('db locked'));
			const error_spy = jest.spyOn(Logger.prototype, 'error');

			await taskService.collectMintMetrics();

			expect(error_spy).toHaveBeenCalledWith('Error collecting mint metrics: db locked');
		});
	});

	describe('cleanupMintMetrics', () => {
		it('should skip when mint type is not cdk', async () => {
			configService.get.mockReturnValue('nutshell');

			await taskService.cleanupMintMetrics();

			expect(mintMetricsService.cleanupOldMetrics).not.toHaveBeenCalled();
		});

		it('should cleanup for cdk mints with a metrics endpoint configured', async () => {
			configService.get.mockReturnValue('cdk');
			mintMetricsService.cleanupOldMetrics.mockResolvedValue();

			await taskService.cleanupMintMetrics();

			expect(mintMetricsService.cleanupOldMetrics).toHaveBeenCalledTimes(1);
			expect(logger_spy).toHaveBeenCalledWith('Mint metrics cleanup complete');
		});
	});
});
