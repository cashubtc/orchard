/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {AiModel, AiModelOllama, AiModelOpenRouter} from '#server/modules/ai/ai.types';

@ObjectType({description: 'Ollama-specific AI model details'})
export class OrchardAiModelOllama {
	@Field(() => UnixTimestamp, {description: 'Timestamp when the model was last modified'})
	modified_at: number;

	@Field(() => Float, {description: 'Model file size in bytes'})
	size: number;

	@Field({description: 'Model content digest hash'})
	digest: string;

	@Field({description: 'Parent model identifier'})
	parent_model: string;

	@Field({description: 'Model file format'})
	format: string;

	@Field({description: 'Primary model family'})
	family: string;

	@Field(() => [String], {description: 'All model families'})
	families: string[];

	@Field({description: 'Model parameter count'})
	parameter_size: string;

	@Field({description: 'Quantization level applied to the model'})
	quantization_level: string;

	constructor(details: AiModelOllama) {
		this.modified_at = DateTime.fromISO(details.modified_at).toUnixInteger();
		this.size = details.size;
		this.digest = details.digest;
		this.parent_model = details.parent_model;
		this.format = details.format;
		this.family = details.family;
		this.families = details.families;
		this.parameter_size = details.parameter_size;
		this.quantization_level = details.quantization_level;
	}
}

@ObjectType({description: 'OpenRouter-specific AI model details'})
export class OrchardAiModelOpenRouter {
	@Field({description: 'Cost per prompt token'})
	pricing_prompt: string;

	@Field({description: 'Cost per completion token'})
	pricing_completion: string;

	@Field({description: 'Model modality type'})
	modality: string;

	@Field({description: 'Tokenizer used by the model'})
	tokenizer: string;

	@Field(() => Int, {description: 'Maximum number of completion tokens'})
	max_completion_tokens: number;

	@Field({description: 'Model family'})
	family: string;

	constructor(details: AiModelOpenRouter) {
		this.pricing_prompt = details.pricing_prompt;
		this.pricing_completion = details.pricing_completion;
		this.modality = details.modality;
		this.tokenizer = details.tokenizer;
		this.max_completion_tokens = details.max_completion_tokens;
		this.family = details.family;
	}
}

@ObjectType({description: 'AI model'})
export class OrchardAiModel {
	@Field({description: 'Model identifier'})
	model: string;

	@Field({description: 'Display name'})
	name: string;

	@Field(() => Int, {description: 'Maximum context window length in tokens'})
	context_length: number;

	@Field(() => OrchardAiModelOllama, {nullable: true, description: 'Ollama-specific model details'})
	ollama?: OrchardAiModelOllama;

	@Field(() => OrchardAiModelOpenRouter, {nullable: true, description: 'OpenRouter-specific model details'})
	openrouter?: OrchardAiModelOpenRouter;

	constructor(ai_model: AiModel) {
		this.model = ai_model.model;
		this.name = ai_model.name;
		this.context_length = ai_model.context_length;
		this.ollama = ai_model.ollama ? new OrchardAiModelOllama(ai_model.ollama) : undefined;
		this.openrouter = ai_model.openrouter ? new OrchardAiModelOpenRouter(ai_model.openrouter) : undefined;
	}
}
