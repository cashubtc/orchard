/* Local Dependencies */
import {AiMessageRole} from './ai.enums.js';

/* *******************************************************
	Models
******************************************************** */

export type AiModel = {
	model: string;
	name: string;
	context_length: number;
	ollama?: AiModelOllama;
	openrouter?: AiModelOpenRouter;
};

export type AiModelOllama = {
	modified_at: string;
	size: number;
	digest: string;
	parent_model: string;
	format: string;
	family: string;
	families: string[];
	parameter_size: string;
	quantization_level: string;
};

export type AiModelOpenRouter = {
	pricing_prompt: string;
	pricing_completion: string;
	modality: string;
	tokenizer: string;
	max_completion_tokens: number;
	family: string;
};

/* *******************************************************
	Messages
******************************************************** */

export type AiMessage = {
	role: AiMessageRole;
	content: string;
	thinking?: string;
	tool_calls?: AiToolCall[];
	tool_call_id?: string;
};

/* *******************************************************
	Tools
******************************************************** */

export type AiToolParameters = {
	type: string;
	properties: Record<string, unknown>;
	required?: string[];
};

export type AiTool = {
	type: string;
	function: AiToolFunction;
};

export type AiToolFunction = {
	name: string;
	description: string;
	parameters: AiToolParameters;
};

export type AiToolCall = {
	id?: string;
	function: {
		name: string;
		arguments: Record<string, unknown>;
	};
};

/* *******************************************************
	Streaming
******************************************************** */

export type AiStreamChunk = {
	model: string;
	created_at: string;
	message: AiMessage;
	done: boolean;
	done_reason?: string;
	usage?: AiStreamUsage;
	error?: string;
};

export type AiStreamUsage = {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_duration?: number;
	eval_duration?: number;
};
