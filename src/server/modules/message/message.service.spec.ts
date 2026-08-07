/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Local Dependencies */
import {MessageService} from './message.service.js';
import {TelegramService} from './telegram/telegram.service.js';

describe('MessageService', () => {
	let service: MessageService;
	let telegramService: jest.Mocked<TelegramService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MessageService,
				{
					provide: TelegramService,
					useValue: {
						isRunning: jest.fn(),
						broadcastNotification: jest.fn(),
						initializeBot: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<MessageService>(MessageService);
		telegramService = module.get(TelegramService) as jest.Mocked<TelegramService>;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('broadcast', () => {
		it('should skip telegram when bot is not running', async () => {
			telegramService.isRunning.mockReturnValue(false);
			const result = await service.broadcast('Test', 'Body', 'info');
			expect(result.total).toBe(0);
			expect(result.delivered).toEqual({});
			expect(telegramService.broadcastNotification).not.toHaveBeenCalled();
		});

		it('should broadcast via telegram when bot is running', async () => {
			telegramService.isRunning.mockReturnValue(true);
			telegramService.broadcastNotification.mockResolvedValue(2);
			const result = await service.broadcast('Test', 'Body', 'warning');
			expect(result.total).toBe(2);
			expect(result.delivered).toEqual({telegram: 2});
			expect(telegramService.broadcastNotification).toHaveBeenCalledWith('Test', 'Body', 'warning');
		});

		it('should return 0 delivered when telegram has no recipients', async () => {
			telegramService.isRunning.mockReturnValue(true);
			telegramService.broadcastNotification.mockResolvedValue(0);
			const result = await service.broadcast('Test', 'Body', 'critical');
			expect(result.total).toBe(0);
			expect(result.delivered).toEqual({telegram: 0});
		});
	});

	describe('reinitialize', () => {
		it('should call initializeBot on telegram service', async () => {
			telegramService.initializeBot.mockResolvedValue();
			await service.reinitialize();
			expect(telegramService.initializeBot).toHaveBeenCalled();
		});
	});
});
