/* Core Dependencies */
import {Logger} from '@nestjs/common';
/* Application Dependencies */
import {MessageService} from '@server/modules/message/message.service';
/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums.js';
import {AiToolEntry} from '@server/modules/ai/tools/tool.types';

/* *******************************************************
	Logger
******************************************************** */

const logger = new Logger('AgentMessage');

/* *******************************************************
	Tool Definitions
******************************************************** */

/** No-op tool that lets the agent explicitly decide not to notify the operator */
export const SkipMessageTool: AiToolEntry = {
	category: AgentToolCategory.MESSAGE,
	role: AgentToolRole.WRITE,
	title: 'Skip Message',
	description: 'Explicitly skip sending a message to the operator for this run.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.SKIP_MESSAGE,
			description: 'Skip sending a message. Call this when nothing warrants operator attention.',
			parameters: {
				type: 'object',
				properties: {
					reason: {
						type: 'string',
						description:
							'Brief explanation of why no notification is needed (e.g. "no changes since last run", "all services healthy").',
					},
				},
				required: ['reason'],
			},
		},
	},
	handler: async (args: Record<string, unknown>) => {
		const reason = args.reason as string;
		logger.log(`Notification skipped: ${reason}`);
		return {success: true, data: {skipped: true, reason}};
	},
	throttle_max_calls: 1,
	throttle_window_seconds: 60,
};

/** Creates a message tool with optional vendor delivery via MessageService */
export function createSendMessageTool(messageService?: MessageService): AiToolEntry {
	return {
		category: AgentToolCategory.MESSAGE,
		role: AgentToolRole.WRITE,
		title: 'Send Message',
		description: 'Send a notification message to the operator via Telegram.',
		tool: {
			type: 'function',
			function: {
				name: AgentToolName.SEND_MESSAGE,
				description: [
					'Send a message to the operator via Telegram.',
					'',
					'**Severity levels:**',
					'- `info` — noteworthy but not urgent',
					'- `warning` — potential issue that may need attention',
					'- `critical` — requires immediate action',
					'',
					'**Formatting (Telegram legacy Markdown):**',
					'- Supported: *bold*, _italic_, `inline code`, ```code block```',
					'- Every *, _, and ` must have a matching closing character — unmatched ones break the message.',
					'- Use *single asterisks* for bold — NOT **double**.',
					'- Avoid * or _ inside numbers or technical strings (e.g. write "5 x 3" not "5 * 3").',
					'- Do not nest formatting (e.g. no *_bold italic_*).',
					'- Use plain dashes (-) for lists.',
				].join('\n'),
				parameters: {
					type: 'object',
					properties: {
						title: {
							type: 'string',
							description: 'Short summary of the message (e.g. "Channel Force-Closed", "Mint Balance Mismatch").',
						},
						body: {
							type: 'string',
							description: 'Detailed explanation of what was observed and why it matters.',
						},
						severity: {
							type: 'string',
							enum: ['info', 'warning', 'critical'],
							description:
								'The severity level: "info" for noteworthy events, "warning" for potential issues, "critical" for urgent problems.',
						},
					},
					required: ['title', 'body', 'severity'],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const title = args.title as string;
			const body = args.body as string;
			const severity = args.severity as string;

			let message_delivered = 0;
			let message_channels: Record<string, number> = {};

			if (messageService) {
				const result = await messageService.broadcast(title, body, severity);
				message_delivered = result.total;
				message_channels = result.delivered;
			}

			logger.log(`Message [${severity.toUpperCase()}] "${title}" — ${message_delivered} delivered`);

			return {
				success: true,
				data: {
					delivered: message_delivered > 0,
					message_delivered,
					message_channels,
				},
			};
		},
		throttle_max_calls: 1,
		throttle_window_seconds: 60,
	};
}
