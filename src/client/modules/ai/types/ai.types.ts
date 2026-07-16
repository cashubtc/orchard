/* Application Dependencies */
import {ChartType} from '@client/modules/mint/enums/chart-type.enum';
import {MintDataType} from '@client/modules/mint/enums/data-type.enum';
/* Shared Dependencies */
import {
	OrchardAiChatChunk,
	OrchardAiHealth,
	OrchardAiModel,
	OrchardAiAssistant,
	OrchardAgent,
	OrchardAgentDefault,
	OrchardAgentRun,
	OrchardAgentTool,
	AssistantToolName,
	MintUnit,
	AnalyticsInterval,
	SystemMetricsInterval,
	OrchardAiChatStream,
} from '@shared/generated.types';

export type AiChatResponse = {
	ai_chat: OrchardAiChatChunk;
};

export type AiModelResponse = {
	ai_models: OrchardAiModel[];
};

export type AiAssistantResponse = {
	ai_assistant: OrchardAiAssistant;
};

export type AiHealthResponse = {
	ai_health: OrchardAiHealth;
};

export type AiChatAbortResponse = {
	ai_chat_abort: OrchardAiChatStream;
};

export type AiAgentsResponse = {
	ai_agents: OrchardAgent[];
};

export type AiAgentResponse = {
	ai_agent: OrchardAgent;
};

export type AiAgentCreateResponse = {
	ai_agent_create: OrchardAgent;
};

export type AiAgentUpdateResponse = {
	ai_agent_update: OrchardAgent;
};

export type AiAgentDeleteResponse = {
	ai_agent_delete: boolean;
};

export type AiAgentExecuteResponse = {
	ai_agent_execute: OrchardAgentRun;
};

export type AiAgentBatchUpdateResponse = Record<string, OrchardAgent>;

export type AiAgentToolsResponse = {
	ai_agent_tools: OrchardAgentTool[];
};

export type AiAgentDefaultsResponse = {
	ai_agent_defaults: OrchardAgentDefault;
};

export type AiFunction =
	| AiFunctionUpdateSearch
	| AiFunctionUpdateCrewStates
	| AiFunctionUpdateCrewRoles
	| AiFunctionUpdateCrewInviteRole
	| AiFunctionUpdateCrewInviteExpirationEnabled
	| AiFunctionUpdateCrewInviteExpiration
	| AiFunctionUpdateCrewLabel
	| AiFunctionUpdateCrewUserActive
	| AiFunctionUpdateDateRange
	| AiFunctionUpdateMintAnalyticsUnits
	| AiFunctionUpdateAnalyticsInterval
	| AiFunctionUpdateMetricsInterval
	| AiFunctionUpdateMintAnalyticsType
	| AiFunctionUpdateMintName
	| AiFunctionUpdateMintDescription
	| AiFunctionUpdateMintIconUrl
	| AiFunctionUpdateMintDescriptionLong
	| AiFunctionUpdateMintMotd
	| AiFunctionUpdateMintUrlAdd
	| AiFunctionUpdateMintUrlUpdate
	| AiFunctionUpdateMintUrlRemove
	| AiFunctionAddMintContact
	| AiFunctionUpdateMintContact
	| AiFunctionRemoveMintContact
	| AiFunctionUpdateMintEnabled
	| AiFunctionUpdateMintQuoteTtl
	| AiFunctionUpdateMintMethodMin
	| AiFunctionUpdateMintMethodMax
	| AiFunctionUpdateMintMethodDescription
	| AiFunctionUpdateMintKeysetStatus
	| AiFunctionUpdateMintKeysetRotationUnit
	| AiFunctionUpdateMintKeysetRotationInputFeePpk
	| AiFunctionUpdateMintKeysetRotationAmounts
	| AiFunctionUpdateMintDatabaseDataType
	| AiFunctionUpdateMintDatabaseStates
	| AiFunctionUpdateMintBackupFilename
	| AiFunctionUpdateEventLogSections
	| AiFunctionUpdateEventLogTypes
	| AiFunctionUpdateEventLogStatuses
	| AiFunctionUpdateEventLogActorIds
	| AiFunctionResetEventLogFilters
	| AiFunctionUpdateAgentName
	| AiFunctionUpdateAgentDescription
	| AiFunctionUpdateAgentModel
	| AiFunctionUpdateAgentSystemMessage
	| AiFunctionUpdateAgentTools
	| AiFunctionUpdateAgentSchedules
	| AiFunctionUpdateAgentActive;

export type AiFunctionUpdateSearch = {
	name: AssistantToolName.UpdateSearch;
	arguments: {
		search: string;
	};
};

export type AiFunctionUpdateCrewStates = {
	name: AssistantToolName.CrewStatesUpdate;
	arguments: {
		states: string[];
	};
};

export type AiFunctionUpdateCrewRoles = {
	name: AssistantToolName.CrewRolesUpdate;
	arguments: {
		roles: string[];
	};
};

export type AiFunctionUpdateCrewInviteRole = {
	name: AssistantToolName.CrewInviteRoleUpdate;
	arguments: {
		role: string;
	};
};

export type AiFunctionUpdateCrewInviteExpirationEnabled = {
	name: AssistantToolName.CrewInviteExpirationEnabledUpdate;
	arguments: {
		expiration_enabled: boolean;
	};
};

export type AiFunctionUpdateCrewInviteExpiration = {
	name: AssistantToolName.CrewInviteExpirationUpdate;
	arguments: {
		expiration_datetime: string;
	};
};

export type AiFunctionUpdateCrewLabel = {
	name: AssistantToolName.CrewLabelUpdate;
	arguments: {
		label: string;
	};
};

export type AiFunctionUpdateCrewUserActive = {
	name: AssistantToolName.CrewUserActiveUpdate;
	arguments: {
		active: boolean;
	};
};

export type AiFunctionUpdateDateRange = {
	name: AssistantToolName.DateRangeUpdate;
	arguments: {
		date_start: string;
		date_end: string;
	};
};

export type AiFunctionUpdateMintAnalyticsUnits = {
	name: AssistantToolName.MintAnalyticsUnitsUpdate;
	arguments: {
		units: MintUnit[];
	};
};

export type AiFunctionUpdateAnalyticsInterval = {
	name: AssistantToolName.MintAnalyticsIntervalUpdate;
	arguments: {
		interval: AnalyticsInterval;
	};
};

export type AiFunctionUpdateMetricsInterval = {
	name: AssistantToolName.MetricsIntervalUpdate;
	arguments: {
		interval: SystemMetricsInterval;
	};
};

export type AiFunctionUpdateMintAnalyticsType = {
	name: AssistantToolName.MintAnalyticsTypeUpdate;
	arguments: {
		type: ChartType;
	};
};

export type AiFunctionUpdateMintName = {
	name: AssistantToolName.MintNameUpdate;
	arguments: {
		name: string;
	};
};

export type AiFunctionUpdateMintDescription = {
	name: AssistantToolName.MintDescriptionUpdate;
	arguments: {
		description: string;
	};
};

export type AiFunctionUpdateMintIconUrl = {
	name: AssistantToolName.MintIconUrlUpdate;
	arguments: {
		icon_url: string;
	};
};

export type AiFunctionUpdateMintDescriptionLong = {
	name: AssistantToolName.MintDescriptionLongUpdate;
	arguments: {
		description_long: string;
	};
};

export type AiFunctionUpdateMintMotd = {
	name: AssistantToolName.MintMotdUpdate;
	arguments: {
		motd: string;
	};
};

export type AiFunctionUpdateMintUrlAdd = {
	name: AssistantToolName.MintUrlAdd;
	arguments: {
		url: string;
	};
};

export type AiFunctionUpdateMintUrlUpdate = {
	name: AssistantToolName.MintUrlUpdate;
	arguments: {
		old_url: string;
		url: string;
	};
};

export type AiFunctionUpdateMintUrlRemove = {
	name: AssistantToolName.MintUrlRemove;
	arguments: {
		url: string;
	};
};

export type AiFunctionAddMintContact = {
	name: AssistantToolName.MintContactAdd;
	arguments: {
		method: 'email' | 'nostr' | 'twitter';
		info: string;
	};
};

export type AiFunctionUpdateMintContact = {
	name: AssistantToolName.MintContactUpdate;
	arguments: {
		old_method: 'email' | 'nostr' | 'twitter';
		old_info: string;
		method: 'email' | 'nostr' | 'twitter';
		info: string;
	};
};

export type AiFunctionRemoveMintContact = {
	name: AssistantToolName.MintContactRemove;
	arguments: {
		method: 'email' | 'nostr' | 'twitter';
		info: string;
	};
};

export type AiFunctionUpdateMintEnabled = {
	name: AssistantToolName.MintEnabledUpdate;
	arguments: {
		enabled: boolean;
		operation: 'minting' | 'melting';
	};
};

export type AiFunctionUpdateMintQuoteTtl = {
	name: AssistantToolName.MintQuoteTtlUpdate;
	arguments: {
		ttl: number;
		operation: 'minting' | 'melting';
	};
};

export type AiFunctionUpdateMintMethodMin = {
	name: AssistantToolName.MintMethodMinUpdate;
	arguments: {
		min_amount: number;
		operation: 'minting' | 'melting';
		method: string;
		unit: MintUnit;
	};
};

export type AiFunctionUpdateMintMethodMax = {
	name: AssistantToolName.MintMethodMaxUpdate;
	arguments: {
		max_amount: number;
		operation: 'minting' | 'melting';
		method: string;
		unit: MintUnit;
	};
};

export type AiFunctionUpdateMintMethodDescription = {
	name: AssistantToolName.MintMethodDescriptionUpdate;
	arguments: {
		description: boolean;
		method: string;
		unit: MintUnit;
	};
};

export type AiFunctionUpdateMintKeysetStatus = {
	name: AssistantToolName.MintKeysetStatusUpdate;
	arguments: {
		statuses: string[];
	};
};

export type AiFunctionUpdateMintKeysetRotationUnit = {
	name: AssistantToolName.MintKeysetRotationUnitUpdate;
	arguments: {
		unit: MintUnit;
	};
};

export type AiFunctionUpdateMintKeysetRotationInputFeePpk = {
	name: AssistantToolName.MintKeysetRotationInputFeePpkUpdate;
	arguments: {
		input_fee_ppk: number;
	};
};

export type AiFunctionUpdateMintKeysetRotationAmounts = {
	name: AssistantToolName.MintKeysetRotationAmountsUpdate;
	arguments: {
		amounts: number[];
	};
};

export type AiFunctionUpdateMintDatabaseDataType = {
	name: AssistantToolName.MintDatabaseDataTypeUpdate;
	arguments: {
		type: MintDataType;
	};
};

export type AiFunctionUpdateMintDatabaseStates = {
	name: AssistantToolName.MintDatabaseStatesUpdate;
	arguments: {
		states: string[];
	};
};

export type AiFunctionUpdateMintBackupFilename = {
	name: AssistantToolName.MintBackupFilenameUpdate;
	arguments: {
		filename: string;
	};
};

export type AiFunctionUpdateEventLogSections = {
	name: AssistantToolName.EventLogSectionsUpdate;
	arguments: {
		sections: string[];
	};
};

export type AiFunctionUpdateEventLogTypes = {
	name: AssistantToolName.EventLogTypesUpdate;
	arguments: {
		types: string[];
	};
};

export type AiFunctionUpdateEventLogStatuses = {
	name: AssistantToolName.EventLogStatusesUpdate;
	arguments: {
		statuses: string[];
	};
};

export type AiFunctionUpdateEventLogActorIds = {
	name: AssistantToolName.EventLogActorIdsUpdate;
	arguments: {
		actor_ids: string[];
	};
};

export type AiFunctionResetEventLogFilters = {
	name: AssistantToolName.EventLogResetFilters;
	arguments: Record<string, never>;
};

export type AiFunctionUpdateAgentName = {
	name: AssistantToolName.AgentNameUpdate;
	arguments: {
		name: string;
	};
};

export type AiFunctionUpdateAgentDescription = {
	name: AssistantToolName.AgentDescriptionUpdate;
	arguments: {
		description: string;
	};
};

export type AiFunctionUpdateAgentModel = {
	name: AssistantToolName.AgentModelUpdate;
	arguments: {
		model: string;
	};
};

export type AiFunctionUpdateAgentSystemMessage = {
	name: AssistantToolName.AgentSystemMessageUpdate;
	arguments: {
		system_message: string;
	};
};

export type AiFunctionUpdateAgentTools = {
	name: AssistantToolName.AgentToolsUpdate;
	arguments: {
		tools: string[];
	};
};

export type AiFunctionUpdateAgentSchedules = {
	name: AssistantToolName.AgentSchedulesUpdate;
	arguments: {
		schedules: string[];
	};
};

export type AiFunctionUpdateAgentActive = {
	name: AssistantToolName.AgentActiveUpdate;
	arguments: {
		active: boolean;
	};
};
