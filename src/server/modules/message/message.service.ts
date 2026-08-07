/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Local Dependencies */
import {TelegramService} from './telegram/telegram.service.js';

/** Result of a message broadcast across all vendors */
export type MessageResult = {
	delivered: Record<string, number>;
	total: number;
};

@Injectable()
export class MessageService {
	private readonly logger = new Logger(MessageService.name);

	constructor(private readonly telegramService: TelegramService) {}

	/* *******************************************************
		Reply
	******************************************************** */

	/** Send a reply to a specific chat via the active vendor */
	public async sendReply(chat_id: string, text: string): Promise<{success: boolean; message_id?: number}> {
		if (this.telegramService.isRunning()) {
			return this.telegramService.sendMessage(chat_id, text);
		}
		return {success: false};
	}

	/** Edit an existing reply message */
	public async editReply(chat_id: string, message_id: number, text: string): Promise<boolean> {
		if (this.telegramService.isRunning()) {
			return this.telegramService.editMessage(chat_id, message_id, text);
		}
		return false;
	}

	/* *******************************************************
		Broadcast
	******************************************************** */

	/**
	 * Broadcast a message across all enabled vendors.
	 * Returns delivery counts per vendor and total.
	 */
	public async broadcast(title: string, body: string, severity: string): Promise<MessageResult> {
		const delivered: Record<string, number> = {};
		let total = 0;

		/* Telegram */
		if (this.telegramService.isRunning()) {
			const count = await this.telegramService.broadcastNotification(title, body, severity);
			delivered['telegram'] = count;
			total += count;
		}

		/* Future vendors go here */

		this.logger.log(`Message broadcast: ${total} total delivered (${JSON.stringify(delivered)})`);
		return {delivered, total};
	}

	/** Reinitialize all vendor services (e.g. after settings change) */
	public async reinitialize(): Promise<void> {
		await this.telegramService.initializeBot();
	}
}
