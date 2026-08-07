/* Core Dependencies */
import {Injectable, Logger, OnModuleInit, OnModuleDestroy} from '@nestjs/common';
/* Vendor Dependencies */
import {Bot} from 'grammy';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Application Dependencies */
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
import {UserService} from '#server/modules/user/user.service';
/* Native Dependencies */
import {
	MESSAGE_INCOMING_EVENT,
	MESSAGE_RESET_EVENT,
	IncomingMessagePayload,
	ResetMessagePayload,
} from '#server/modules/message/message.types';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TelegramService.name);
	private bot: Bot | null = null;
	private lifecycle: Promise<void> = Promise.resolve();

	constructor(
		private readonly settingService: SettingService,
		private readonly userService: UserService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/* *******************************************************
		Lifecycle
	******************************************************** */

	async onModuleInit(): Promise<void> {
		if (process.env.SCHEMA_ONLY) return;
		await this.initializeBot();
	}

	async onModuleDestroy(): Promise<void> {
		await this.stopBot();
	}

	/* *******************************************************
		Bot Management
	******************************************************** */

	/** Initialize or re-initialize the bot from current settings */
	public initializeBot(): Promise<void> {
		this.lifecycle = this.lifecycle.catch(() => {}).then(() => this.startBot());
		return this.lifecycle;
	}

	private async startBot(): Promise<void> {
		await this.stopBot();

		const enabled = await this.settingService.getBooleanSetting(SettingKey.MESSAGES_ENABLED);
		const vendor = await this.settingService.getStringSetting(SettingKey.MESSAGES_VENDOR);
		const token = await this.settingService.getStringSetting(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN);
		if (!enabled || vendor !== 'telegram' || !token) return;

		const bot = new Bot(token);
		try {
			await bot.init();
		} catch (error) {
			this.logger.error(`Failed to initialize Telegram bot: ${error.message}`);
			return;
		}

		this.bot = bot;
		this.registerHandlers();
		bot.start({drop_pending_updates: true}).catch((error) => {
			this.logger.error(`Telegram bot polling error: ${error.message}`);
			if (this.bot === bot) this.bot = null;
		});
		this.logger.log('Telegram bot started (long-polling)');
	}

	/** Stop the running bot and wait for the poll loop to drain */
	private async stopBot(): Promise<void> {
		const bot = this.bot;
		if (!bot) return;
		this.bot = null;
		try {
			await bot.stop();
		} catch (error) {
			this.logger.warn(`Error stopping Telegram bot: ${error.message}`);
		}
	}

	/* *******************************************************
		Handlers
	******************************************************** */

	/** Register bot command and message handlers */
	private registerHandlers(): void {
		if (!this.bot) return;

		this.bot.command('start', async (ctx) => {
			const chat_id = ctx.chat.id.toString();
			await ctx.reply(
				`Welcome to Orchard!\n\nYour Telegram Chat ID is:\n\n${chat_id}\n\nEnter this in your Orchard user settings to link your account.`,
			);
		});

		this.bot.command('new', async (ctx) => {
			const chat_id = ctx.chat.id.toString();
			const user = await this.userService.getUserByTelegramChatId(chat_id);
			if (!user) {
				await ctx.reply('Your Telegram account is not linked to an Orchard user. Use /start to get your Chat ID.');
				return;
			}
			try {
				const payload: ResetMessagePayload = {chat_id, user_id: user.id};
				await this.eventEmitter.emitAsync(MESSAGE_RESET_EVENT, payload);
			} catch (error) {
				this.logger.error(`Error handling /new command from ${chat_id}: ${error.message}`);
				await ctx.reply('Something went wrong resetting your conversation. Please try again.');
			}
		});

		this.bot.on('message:text', async (ctx) => {
			if (ctx.message.text.startsWith('/')) return;
			const chat_id = ctx.chat.id.toString();
			const user = await this.userService.getUserByTelegramChatId(chat_id);
			if (!user) {
				await ctx.reply('Your Telegram account is not linked to an Orchard user. Use /start to get your Chat ID.');
				return;
			}
			try {
				const payload: IncomingMessagePayload = {chat_id, user_id: user.id, text: ctx.message.text};
				await this.eventEmitter.emitAsync(MESSAGE_INCOMING_EVENT, payload);
			} catch (error) {
				this.logger.error(`Error handling incoming message from ${chat_id}: ${error.message}`);
				await ctx.reply('Something went wrong processing your message. Please try again.');
			}
		});

		this.bot.catch((error) => {
			this.logger.error(`Telegram bot error: ${error.message}`);
		});
	}

	/* *******************************************************
		Messaging
	******************************************************** */

	/** Send a message to a specific Telegram chat, falling back to plain text if Markdown parsing fails */
	public async sendMessage(chat_id: string, text: string): Promise<{success: boolean; message_id?: number}> {
		if (!this.bot) return {success: false};
		try {
			const result = await this.withMarkdownFallback((opts) => this.bot!.api.sendMessage(chat_id, text, opts), `send to ${chat_id}`);
			return {success: true, message_id: result.message_id};
		} catch (error) {
			this.logger.error(`Failed to send Telegram message to ${chat_id}: ${error.message}`);
			return {success: false};
		}
	}

	/** Edit an existing message, falling back to plain text if Markdown parsing fails */
	public async editMessage(chat_id: string, message_id: number, text: string): Promise<boolean> {
		if (!this.bot) return false;
		try {
			await this.withMarkdownFallback((opts) => this.bot!.api.editMessageText(chat_id, message_id, text, opts), `edit in ${chat_id}`);
			return true;
		} catch (error) {
			this.logger.error(`Failed to edit Telegram message in ${chat_id}: ${error.message}`);
			return false;
		}
	}

	/** Try an API call with Markdown, retry as plain text if Telegram rejects the formatting */
	private async withMarkdownFallback<T>(action: (opts?: {parse_mode: 'Markdown'}) => Promise<T>, label: string): Promise<T> {
		try {
			return await action({parse_mode: 'Markdown'});
		} catch (error) {
			if (error.message?.includes("can't parse entities")) {
				this.logger.warn(`Markdown parse failed for ${label}, retrying as plain text`);
				return await action();
			}
			throw error;
		}
	}

	/** Send a notification to all users with linked Telegram accounts */
	public async broadcastNotification(title: string, body: string, severity: string): Promise<number> {
		if (!this.bot) return 0;

		const users = await this.userService.getUsersWithTelegramChatId();
		if (users.length === 0) return 0;

		const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
		const message = `${emoji} *${title}*\n\n${body}`;

		let delivered_count = 0;
		for (const user of users) {
			const {success} = await this.sendMessage(user.telegram_chat_id!, message);
			if (success) delivered_count++;
		}

		this.logger.log(`Telegram notification broadcast: ${delivered_count}/${users.length} delivered`);
		return delivered_count;
	}

	/** Check if the bot is currently running */
	public isRunning(): boolean {
		return this.bot !== null;
	}
}
