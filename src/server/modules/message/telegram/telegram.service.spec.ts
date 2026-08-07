/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Vendor Dependencies */
import {EventEmitter2} from '@nestjs/event-emitter';
/* Application Dependencies */
import {SettingService} from '@server/modules/setting/setting.service';
import {UserService} from '@server/modules/user/user.service';
/* Local Dependencies */
import {TelegramService} from './telegram.service.js';

describe('TelegramService', () => {
	let service: TelegramService;
	let settingService: jest.Mocked<SettingService>;
	let userService: jest.Mocked<UserService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TelegramService,
				{
					provide: SettingService,
					useValue: {
						getSetting: jest.fn(),
						getBooleanSetting: jest.fn(),
						getStringSetting: jest.fn(),
					},
				},
				{
					provide: UserService,
					useValue: {
						getUsersWithTelegramChatId: jest.fn(),
						getUserByTelegramChatId: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
						emitAsync: jest.fn().mockResolvedValue([]),
					},
				},
			],
		}).compile();

		service = module.get<TelegramService>(TelegramService);
		settingService = module.get(SettingService) as jest.Mocked<SettingService>;
		userService = module.get(UserService) as jest.Mocked<UserService>;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('isRunning', () => {
		it('should return false when bot is not initialized', () => {
			expect(service.isRunning()).toBe(false);
		});
	});

	describe('sendMessage', () => {
		it('should return unsuccessful result when bot is not running', async () => {
			const result = await service.sendMessage('123', 'test');
			expect(result).toEqual({success: false});
		});
	});

	describe('broadcastNotification', () => {
		it('should return 0 when bot is not running', async () => {
			const result = await service.broadcastNotification('Test', 'Body', 'info');
			expect(result).toBe(0);
		});

		it('should return 0 when no users have telegram_chat_id', async () => {
			userService.getUsersWithTelegramChatId.mockResolvedValue([]);
			const result = await service.broadcastNotification('Test', 'Body', 'info');
			expect(result).toBe(0);
		});
	});

	describe('initializeBot', () => {
		it('should not start bot when messages are disabled', async () => {
			settingService.getBooleanSetting.mockResolvedValue(false);
			await service.initializeBot();
			expect(service.isRunning()).toBe(false);
		});

		it('should not start bot when vendor is not telegram', async () => {
			settingService.getBooleanSetting.mockResolvedValue(true);
			settingService.getStringSetting.mockResolvedValueOnce('pushover');
			await service.initializeBot();
			expect(service.isRunning()).toBe(false);
		});

		it('should not start bot when token is empty', async () => {
			settingService.getBooleanSetting.mockResolvedValue(true);
			settingService.getStringSetting.mockResolvedValueOnce('telegram');
			settingService.getStringSetting.mockResolvedValueOnce(null);
			await service.initializeBot();
			expect(service.isRunning()).toBe(false);
		});
	});
});
