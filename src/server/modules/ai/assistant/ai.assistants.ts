/* Local Dependencies */
import {AiAssistant} from './ai.assistant.enums';
import {
	UpdateSearchTool,
	UpdateDateRangeTool,
	UpdateCrewStatesTool,
	UpdateCrewRolesTool,
	UpdateCrewInviteRoleTool,
	UpdateCrewInviteExpirationEnabledTool,
	UpdateCrewInviteExpirationTool,
	UpdateCrewLabelTool,
	UpdateCrewUserActiveTool,
	UpdateMintAnalyticsUnitsTool,
	UpdateMintAnalyticsIntervalTool,
	UpdateMetricsIntervalTool,
	UpdateMintNameTool,
	UpdateMintDescriptionTool,
	UpdateMintIconUrlTool,
	UpdateMintDescriptionLongTool,
	UpdateMintMotdTool,
	AddMintUrlTool,
	UpdateMintUrlTool,
	RemoveMintUrlTool,
	AddMintContactTool,
	UpdateMintContactTool,
	RemoveMintContactTool,
	UpdateMintEnabledTool,
	UpdateMintQuoteTtlTool,
	UpdateMintMethodMinTool,
	UpdateMintMethodMaxTool,
	UpdateMintMethodDescriptionTool,
	UpdateMintKeysetStatusTool,
	UpdateMintKeysetRotationUnitTool,
	UpdateMintKeysetRotationInputFeePpkTool,
	UpdateMintKeysetRotationAmountsTool,
	UpdateMintDatabaseDataTypeTool,
	UpdateMintDatabaseStatesTool,
	UpdateMintBackupFilenameTool,
	UpdateEventLogSectionsTool,
	UpdateEventLogTypesTool,
	UpdateEventLogStatusesTool,
	UpdateEventLogActorIdsTool,
	ResetEventLogFiltersTool,
	UpdateAgentNameTool,
	UpdateAgentDescriptionTool,
	UpdateAgentModelTool,
	UpdateAgentSystemMessageTool,
	UpdateAgentToolsTool,
	UpdateAgentSchedulesTool,
	UpdateAgentActiveTool,
} from './tools';

export const AI_ASSISTANTS = {
	[AiAssistant.DEFAULT]: {
		name: 'Orchard Agent',
		icon: 'spa',
		section: null,
		description: 'The general purpose agent',
		system_message: {
			role: 'system',
			content: 'You are a helpful assistant that can answer questions and help with tasks.',
		},
		tools: [],
	},
	[AiAssistant.INDEX_CREW]: {
		name: 'Crew Agent',
		icon: 'spa',
		section: 'index',
		description: 'Control the filters of the crew table',
		system_message: {
			role: 'system',
			content:
				'You are an agent designed to help adjust parameters used to explore the users of the application and any open invites.',
		},
		tools: [UpdateSearchTool, UpdateCrewStatesTool, UpdateCrewRolesTool],
	},
	[AiAssistant.INDEX_CREW_INVITE]: {
		name: 'Crew Invite Agent',
		icon: 'spa',
		section: 'index',
		description: 'Control the filters of the crew invite table',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help configure crew invites.
				When the user asks you to make changes, you MUST immediately call the appropriate tool functions to apply those changes.
				Do not explain what you would do - actually execute the tool calls.
				You have access to these tools and should use them to fulfill user requests:
				- Update invite role
				- Update invite label
				- Update expiration enabled status
				- Update expiration date and time
				Always call the tools to make the requested changes, then briefly confirm what was done.`,
		},
		tools: [UpdateCrewInviteRoleTool, UpdateCrewLabelTool, UpdateCrewInviteExpirationEnabledTool, UpdateCrewInviteExpirationTool],
	},
	[AiAssistant.INDEX_CREW_USER]: {
		name: 'Crew User Agent',
		icon: 'spa',
		section: 'index',
		description: 'Control user settings',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help configure user settings.
				When the user asks you to make changes, you MUST immediately call the appropriate tool functions to apply those changes.
				Always call the tools to make the requested changes, then briefly confirm what was done.`,
		},
		tools: [UpdateCrewUserActiveTool, UpdateCrewInviteRoleTool, UpdateCrewLabelTool],
	},
	[AiAssistant.MINT_DASHBOARD]: {
		name: 'Mint Dashboard Agent',
		icon: 'spa',
		section: 'mint',
		description: 'Control the filters of the mint analytics',
		system_message: {
			role: 'system',
			content: 'You are an agent designed to help adjust parameters used to explore mint analytics.',
		},
		tools: [UpdateDateRangeTool, UpdateMintAnalyticsUnitsTool, UpdateMintAnalyticsIntervalTool],
	},
	[AiAssistant.MINT_SERVER]: {
		name: 'Mint Server Agent',
		icon: 'spa',
		section: 'mint',
		description: 'Control the filters of the mint server metrics',
		system_message: {
			role: 'system',
			content: 'You are an agent designed to help adjust parameters used to explore mint server metrics.',
		},
		tools: [UpdateDateRangeTool, UpdateMetricsIntervalTool],
	},
	[AiAssistant.MINT_INFO]: {
		name: 'Mint Info Agent',
		icon: 'spa',
		section: 'mint',
		description: 'Mint info agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help manage, update, and configure the public information of a cashu mint.
            You will be provided with the current state of the form along with the users request for additions or changes`,
		},
		tools: [
			UpdateMintNameTool,
			UpdateMintDescriptionTool,
			UpdateMintIconUrlTool,
			UpdateMintDescriptionLongTool,
			UpdateMintMotdTool,
			AddMintUrlTool,
			UpdateMintUrlTool,
			RemoveMintUrlTool,
			AddMintContactTool,
			UpdateMintContactTool,
			RemoveMintContactTool,
		],
	},
	[AiAssistant.MINT_CONFIG]: {
		name: 'Mint Config',
		icon: 'spa',
		section: 'mint',
		description: 'Mint config agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help configure the operational parameters of a cashu mint.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [
			UpdateMintEnabledTool,
			UpdateMintQuoteTtlTool,
			UpdateMintMethodMinTool,
			UpdateMintMethodMaxTool,
			UpdateMintMethodDescriptionTool,
		],
	},
	[AiAssistant.MINT_KEYSETS]: {
		name: 'Mint Keysets',
		icon: 'spa',
		section: 'mint',
		description: 'Mint keysets agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help explore data related to mint keysets.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [UpdateDateRangeTool, UpdateMintAnalyticsUnitsTool, UpdateMintKeysetStatusTool],
	},
	[AiAssistant.MINT_KEYSET_ROTATION]: {
		name: 'Mint Keyset Rotation',
		icon: 'spa',
		section: 'mint',
		description: 'Mint keyset rotation agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help rotate keysets in a cashu mint.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [UpdateMintKeysetRotationUnitTool, UpdateMintKeysetRotationInputFeePpkTool, UpdateMintKeysetRotationAmountsTool],
	},
	[AiAssistant.MINT_DATABASE]: {
		name: 'Mint Database',
		icon: 'spa',
		section: 'mint',
		description: 'Mint database agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help explore the database of a cashu mint.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [UpdateDateRangeTool, UpdateMintAnalyticsUnitsTool, UpdateMintDatabaseDataTypeTool, UpdateMintDatabaseStatesTool],
	},
	[AiAssistant.MINT_BACKUP]: {
		name: 'Mint Backup',
		icon: 'spa',
		section: 'mint',
		description: 'Mint backup agent',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help create database backups of a cashu mint.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [UpdateMintBackupFilenameTool],
	},
	[AiAssistant.EVENT_LOG]: {
		name: 'Event Log Agent',
		icon: 'spa',
		section: 'settings',
		description: 'Control the filters of the event log',
		system_message: {
			role: 'system',
			content: `You are an agent designed to help explore and filter event logs.
            You will be provided with the current state of the form along with the users request for changes`,
		},
		tools: [
			UpdateDateRangeTool,
			UpdateEventLogSectionsTool,
			UpdateEventLogTypesTool,
			UpdateEventLogStatusesTool,
			UpdateEventLogActorIdsTool,
			ResetEventLogFiltersTool,
		],
	},
	[AiAssistant.SETTINGS_AGENT]: {
		name: 'Agent Settings Assistant',
		icon: 'spa',
		section: 'settings',
		description: 'Help configure AI agents through natural language',
		system_message: {
			role: 'system',
			content: `You are an assistant designed to help users configure AI agents.
You will be provided with the current form state, available models, and available tools (with categories).

## Rules

- When the user asks you to make changes, you **MUST** immediately call the appropriate tool functions to apply those changes.
- Do not explain what you would do — actually execute the tool calls.
- You may call multiple tools at once when configuring several fields.
- Always call the tools to make the requested changes, then briefly confirm what was done.

## Validation

- **Tool names** in the tools array must exactly match names from the available tools list.
- **Model names** must exactly match a model from the available models list.
- **Schedules** must be valid cron expressions (e.g. \`0 */6 * * *\` for every 6 hours).
- **System messages** should be detailed, well-structured prompts that clearly define the agent's role, behavior, and constraints.

## Default Tools

Every agent job should include the **memory** and **message** tool categories. When setting tools, always add:
- \`GET_PAST_RUNS\` (memory) — lets the agent review its own history and avoid duplicate messages.
- \`SEND_MESSAGE\` (message) — lets the agent notify the operator.
- \`SKIP_MESSAGE\` (message) — lets the agent explicitly decide not to notify.

For **alerting / monitoring** jobs (e.g. health checks, threshold watchers), include all three: \`GET_PAST_RUNS\`, \`SKIP_MESSAGE\`, and \`SEND_MESSAGE\`.
For **reporting / low-frequency** jobs (e.g. daily summaries, periodic audits), include \`GET_PAST_RUNS\` and \`SEND_MESSAGE\` only — these jobs should always send a message.`,
		},
		tools: [
			UpdateAgentNameTool,
			UpdateAgentDescriptionTool,
			UpdateAgentModelTool,
			UpdateAgentSystemMessageTool,
			UpdateAgentToolsTool,
			UpdateAgentSchedulesTool,
			UpdateAgentActiveTool,
		],
	},
};
