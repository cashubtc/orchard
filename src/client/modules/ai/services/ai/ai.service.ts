/* Core Dependencies */
import {Injectable, signal, computed} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
/* Vendor Dependencies */
import {Observable, catchError, Subject, BehaviorSubject, of, map, tap, switchMap, throwError, shareReplay, finalize} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
/* Application Dependencies */
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
import {getApiQuery, hasGqlWsErrorCode} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
/* Native Dependencies */
import {
	AiChatResponse,
	AiHealthResponse,
	AiModelResponse,
	AiAssistantResponse,
	AiChatAbortResponse,
	AiAgentsResponse,
	AiAgentResponse,
	AiAgentCreateResponse,
	AiAgentUpdateResponse,
	AiAgentBatchUpdateResponse,
	AiAgentDeleteResponse,
	AiAgentExecuteResponse,
	AiAgentToolsResponse,
	AiAgentDefaultsResponse,
} from '@client/modules/ai/types/ai.types';
import {AiChatChunk, AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {AiHealth} from '@client/modules/ai/classes/ai-health.class';
import {AiModel} from '@client/modules/ai/classes/ai-model.class';
import {AiChatCompiledMessage} from '@client/modules/ai/classes/ai-chat-compiled-message.class';
import {AiChatConversation} from '@client/modules/ai/classes/ai-chat-conversation.class';
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';
import {AiAgent} from '@client/modules/ai/classes/ai-agent.class';
import {AiAgentTool} from '@client/modules/ai/classes/ai-agent-tool.class';
import {AiAgentDefault} from '@client/modules/ai/classes/ai-agent-default.class';
import {AiAgentRun} from '@client/modules/ai/classes/ai-agent-run.class';
/* Local Dependencies */
import {
	AI_CHAT_SUBSCRIPTION,
	AI_HEALTH_QUERY,
	AI_MODELS_QUERY,
	AI_ASSISTANT_QUERY,
	AI_CHAT_ABORT_MUTATION,
	AI_AGENT_TOOLS_QUERY,
	AI_AGENT_DEFAULTS_QUERY,
	AI_AGENTS_QUERY,
	AI_AGENT_QUERY,
	AI_AGENT_CREATE_MUTATION,
	AI_AGENT_UPDATE_MUTATION,
	AI_AGENT_DELETE_MUTATION,
	AI_AGENT_EXECUTE_MUTATION,
	buildAgentBatchMutation,
} from './ai.queries';
/* Shared Dependencies */
import {AgentKey, AiAssistant, AiMessageRole, OrchardAgentTool} from '@shared/generated.types';

@Injectable({
	providedIn: 'root',
})
export class AiService {
	public get active$(): Observable<boolean> {
		return this.active_subject.asObservable();
	}
	public get conversation$(): Observable<AiChatConversation | null> {
		return this.conversation_subject.asObservable();
	}
	public get messages$(): Observable<AiChatChunk> {
		return this.message_subject.asObservable();
	}
	public get tool_calls$(): Observable<AiChatToolCall> {
		return this.toolcall_subject.asObservable();
	}
	public get assistant_requests$(): Observable<{assistant: AiAssistant; content: string | null}> {
		return this.assistant_subject.asObservable();
	}

	public readonly pending_assistant = signal<boolean>(false);
	public readonly staged_assistant_definition = signal<AiAssistantDefinition | null>(null);

	public readonly staged_assistant = computed(() => this.override_assistant() ?? this.route_assistant());

	private dispose_subscription?: () => void;
	private subscription_id?: string | null;
	private conversation_subject = new Subject<AiChatConversation | null>();
	private message_subject = new Subject<AiChatChunk>();
	private toolcall_subject = new Subject<AiChatToolCall>();
	private assistant_subject = new Subject<{assistant: AiAssistant; content: string | null}>();
	private active_subject = new Subject<boolean>();
	private conversation_cache: AiChatConversation | null = null;
	private assistant_sync_started = false;
	private ai_models_observable!: Observable<AiModel[]> | null;

	private readonly CACHE_KEYS = {AI_AGENT_TOOLS: 'AI_AGENT_TOOLS'};
	private readonly CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
	private agent_tools_subject: BehaviorSubject<OrchardAgentTool[] | null>;

	private readonly route_assistant = signal<AiAssistant>(AiAssistant.Default);
	private readonly override_assistant = signal<AiAssistant | null>(null);
	private readonly assistant_definitions = signal<ReadonlyMap<AiAssistant, AiAssistantDefinition>>(new Map());

	// Declared last: toObservable() runs at field init, so its source signals must already be assigned
	private readonly staged_assistant$ = toObservable(this.staged_assistant);

	constructor(
		private cacheService: CacheService,
		private apiService: ApiService,
		private settingDeviceService: SettingDeviceService,
		private authService: AuthService,
		private router: Router,
		private http: HttpClient,
	) {
		this.agent_tools_subject = this.cacheService.createCache<OrchardAgentTool[]>(this.CACHE_KEYS.AI_AGENT_TOOLS, this.CACHE_DURATION);
	}

	public getFunctionModel(): Observable<AiModel | null> {
		const set_model = this.settingDeviceService.getModel();
		return this.getAiModels().pipe(
			map((models) => {
				const set = models.find((model) => model.model === set_model);
				if (set) return set;
				return this.getSmallestFunctionModel(models);
			}),
		);
	}

	public requestAssistant(assistant: AiAssistant, content: string | null): void {
		this.assistant_subject.next({assistant, content});
	}

	/** Sets the base assistant from route data */
	public setRouteAssistant(assistant: AiAssistant): void {
		this.route_assistant.set(assistant);
	}

	/** Imperatively overrides the staged assistant (e.g. when a form panel opens) */
	public setAssistantOverride(assistant: AiAssistant): void {
		this.override_assistant.set(assistant);
	}

	/** Clears the override, falling back to the route assistant */
	public clearAssistantOverride(): void {
		this.override_assistant.set(null);
	}

	public openAiSocket(assistant: AiAssistant, content: string | null, context?: string): void {
		const subscription_id = uuidv4();
		const ai_model = this.settingDeviceService.getModel();
		this.subscription_id = subscription_id;
		this.active_subject.next(true);
		this.pending_assistant.set(true);

		// A different assistant starts fresh — inherited turns and stale form state would
		// otherwise land in the new assistant's context window
		if (this.conversation_cache && this.conversation_cache.assistant !== assistant) this.clearConversation();

		const conversation = !this.conversation_cache
			? this.createConversation(subscription_id, assistant, content, context)
			: this.continueConversation(subscription_id, assistant, content, context);
		this.conversation_subject.next(conversation);
		const messages = conversation.getMessages();

		this.dispose_subscription = this.apiService.gql_client.subscribe<AiChatResponse>(
			getApiQuery(AI_CHAT_SUBSCRIPTION, {
				ai_chat: {id: subscription_id, messages, model: ai_model, assistant},
			}),
			{
				next: (response) => {
					if (!response.data?.ai_chat) return;
					const chunk = new AiChatChunk(response.data.ai_chat, subscription_id);
					if (chunk.has_output) this.pending_assistant.set(false);
					this.message_subject.next(chunk);
					chunk.message.tool_calls?.forEach((tool_call) => this.toolcall_subject.next(tool_call));
					if (chunk.done) this.closeAiSocket();
				},
				error: (error) => {
					if (hasGqlWsErrorCode(error, 10002)) {
						this.closeAiSocket();
						this.retryAiSocket(assistant, content, context);
						return;
					}
					console.error('Socket error:', error);
					this.closeAiSocket();
				},
				complete: () => this.closeAiSocket(),
			},
		);
	}

	public abortAiSocket(id?: string): void {
		const subscription_id = id || this.subscription_id;
		if (!subscription_id) return;
		const query = getApiQuery(AI_CHAT_ABORT_MUTATION, {id: subscription_id});
		this.http
			.post<OrchardRes<AiChatAbortResponse>>(this.apiService.api, query)
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.ai_chat_abort;
				}),
				catchError((error) => {
					console.error('Error aborting ai socket:', error);
					return throwError(() => error);
				}),
				finalize(() => {
					this.closeAiSocket();
				}),
			)
			.subscribe();
	}

	private closeAiSocket(): void {
		const dispose = this.dispose_subscription;
		if (!dispose) return;
		this.dispose_subscription = undefined;
		this.subscription_id = null;
		this.pending_assistant.set(false);
		this.active_subject.next(false);
		dispose();
	}

	public getAiHealth(): Observable<AiHealth> {
		const query = getApiQuery(AI_HEALTH_QUERY);

		return this.http.post<OrchardRes<AiHealthResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_health;
			}),
			map((ai_health) => new AiHealth(ai_health)),
			catchError((error) => {
				console.error('Error loading ai health:', error);
				return throwError(() => error);
			}),
		);
	}

	public getAiModels(): Observable<AiModel[]> {
		if (this.ai_models_observable) return this.ai_models_observable;
		const query = getApiQuery(AI_MODELS_QUERY);

		this.ai_models_observable = this.http.post<OrchardRes<AiModelResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_models;
			}),
			map((ai_models) => ai_models.map((ai_model) => new AiModel(ai_model))),
			tap(() => {
				this.ai_models_observable = null;
			}),
			shareReplay(1),
			catchError((error) => {
				console.error('Error loading ai models:', error);
				this.ai_models_observable = null;
				return throwError(() => error);
			}),
		);
		return this.ai_models_observable;
	}

	public getAiAssistant(assistant: AiAssistant): Observable<AiAssistantDefinition> {
		const cached = this.assistant_definitions().get(assistant);
		if (cached) return of(cached);
		const query = getApiQuery(AI_ASSISTANT_QUERY, {assistant});

		return this.http.post<OrchardRes<AiAssistantResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_assistant;
			}),
			map((oaa) => new AiAssistantDefinition(oaa)),
			tap((definition) => this.assistant_definitions.update((definitions) => new Map(definitions).set(assistant, definition))),
			catchError((error) => {
				console.error('Error loading ai assistant:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Returns an assistant definition already fetched this session, or null if it has not loaded yet */
	public getLoadedAssistant(assistant: AiAssistant): AiAssistantDefinition | null {
		return this.assistant_definitions().get(assistant) ?? null;
	}

	/** Keeps `staged_assistant_definition` in step with the staged assistant.
	 *  Idempotent, and never started for AI-disabled installs. */
	public syncAssistantDefinition(): void {
		if (this.assistant_sync_started) return;
		this.assistant_sync_started = true;
		this.staged_assistant$
			.pipe(switchMap((assistant) => this.getAiAssistant(assistant).pipe(catchError(() => of(null)))))
			.subscribe((definition) => this.staged_assistant_definition.set(definition));
	}

	/* *******************************************************
		Agents
	******************************************************** */

	/** Fetches all available AI agent tools (cached for 60 minutes) */
	public loadAiAgentTools(): Observable<AiAgentTool[]> {
		if (this.agent_tools_subject.value && this.cacheService.isCacheValid(this.CACHE_KEYS.AI_AGENT_TOOLS)) {
			return of(this.agent_tools_subject.value as AiAgentTool[]);
		}

		const query = getApiQuery(AI_AGENT_TOOLS_QUERY);

		return this.http.post<OrchardRes<AiAgentToolsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_tools;
			}),
			map((tools) => tools.map((tool) => new AiAgentTool(tool))),
			tap((tools) => {
				this.cacheService.updateCache(this.CACHE_KEYS.AI_AGENT_TOOLS, tools);
			}),
			shareReplay(1),
			catchError((error) => {
				console.error('Error loading ai agent tools:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Fetches default configuration for an AI agent */
	public getAiAgentDefaults(agent_key: AgentKey): Observable<AiAgentDefault> {
		const query = getApiQuery(AI_AGENT_DEFAULTS_QUERY, {agent_key});

		return this.http.post<OrchardRes<AiAgentDefaultsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_defaults;
			}),
			map((defaults) => new AiAgentDefault(defaults)),
			catchError((error) => {
				console.error('Error loading ai agent defaults:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Fetches all AI agents */
	public getAiAgents(): Observable<AiAgent[]> {
		const query = getApiQuery(AI_AGENTS_QUERY);

		return this.http.post<OrchardRes<AiAgentsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agents;
			}),
			map((agents) => agents.map((agent) => new AiAgent(agent))),
			catchError((error) => {
				console.error('Error loading ai agents:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Fetches a single AI agent by ID */
	public getAiAgent(id: string): Observable<AiAgent> {
		const query = getApiQuery(AI_AGENT_QUERY, {id});

		return this.http.post<OrchardRes<AiAgentResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent;
			}),
			map((agent) => new AiAgent(agent)),
			catchError((error) => {
				console.error('Error loading ai agent:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Creates a new custom AI agent */
	public createAiAgent(fields: {
		name: string;
		description?: string;
		active?: boolean;
		model?: string;
		system_message?: string;
		tools?: string[];
		schedules?: string[];
	}): Observable<AiAgent> {
		const query = getApiQuery(AI_AGENT_CREATE_MUTATION, fields);

		return this.http.post<OrchardRes<AiAgentCreateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_create;
			}),
			map((agent) => new AiAgent(agent)),
			catchError((error) => {
				console.error('Error creating ai agent:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Updates an AI agent configuration */
	public updateAiAgent(
		id: string,
		updates: Partial<{
			name: string;
			description: string;
			active: boolean;
			model: string;
			system_message: string;
			tools: string[];
			schedules: string[];
		}>,
	): Observable<AiAgent> {
		const query = getApiQuery(AI_AGENT_UPDATE_MUTATION, {id, ...updates});

		return this.http.post<OrchardRes<AiAgentUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_update;
			}),
			map((agent) => new AiAgent(agent)),
			catchError((error) => {
				console.error('Error updating ai agent:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Updates multiple AI agents in a single batched request */
	public updateAiAgentsBatch(agents: {id: string; updates: Record<string, unknown>}[]): Observable<AiAgent[]> {
		const {query, variables} = buildAgentBatchMutation(agents);

		return this.http.post<OrchardRes<AiAgentBatchUpdateResponse>>(this.apiService.api, {query, variables}).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return Object.values(response.data).map((agent) => new AiAgent(agent));
			}),
			catchError((error) => {
				console.error('Error batch updating ai agents:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Deletes a custom AI agent by ID */
	public deleteAiAgent(id: string): Observable<boolean> {
		const query = getApiQuery(AI_AGENT_DELETE_MUTATION, {id});

		return this.http.post<OrchardRes<AiAgentDeleteResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_delete;
			}),
			catchError((error) => {
				console.error('Error deleting ai agent:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Manually triggers an agent execution and returns the run result */
	public executeAiAgent(id: string): Observable<AiAgentRun> {
		const query = getApiQuery(AI_AGENT_EXECUTE_MUTATION, {id});

		return this.http.post<OrchardRes<AiAgentExecuteResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ai_agent_execute;
			}),
			map((run) => new AiAgentRun(run)),
			catchError((error) => {
				console.error('Error executing ai agent:', error);
				return throwError(() => error);
			}),
		);
	}

	private getSmallestFunctionModel(models: AiModel[]): AiModel | null {
		if (models.length === 0) return null;
		const getSize = (m: AiModel) => m.ollama?.size ?? 0;
		const llama_models = models.filter((model) => model.model.includes('llama'));
		if (llama_models.length > 0) return llama_models.sort((a, b) => getSize(a) - getSize(b))[0];
		return [...models].sort((a, b) => getSize(a) - getSize(b))[0];
	}

	private createConversation(
		id: string,
		assistant: AiAssistant,
		content: string | null,
		context: string | undefined,
	): AiChatConversation {
		const messages = [];
		if (context)
			messages.push({
				role: AiMessageRole.System,
				content: this.getFullContext(context, AiMessageRole.System),
			});
		messages.push({
			role: AiMessageRole.User,
			content: content || '',
		});
		const messages_obj = messages.map((message) => new AiChatCompiledMessage(id, message));
		return new AiChatConversation(id, messages_obj, assistant);
	}

	private continueConversation(
		id: string,
		assistant: AiAssistant,
		content: string | null,
		context: string | undefined,
	): AiChatConversation {
		if (!this.conversation_cache) throw new Error('Conversation cache not found');
		if (context) {
			const last_message = this.conversation_cache.messages[this.conversation_cache.messages.length - 1];
			if (last_message.role === AiMessageRole.Assistant && last_message.tool_calls?.length) {
				this.conversation_cache.messages.push(
					new AiChatCompiledMessage(id, {
						role: AiMessageRole.Tool,
						content: this.getFullContext(context, AiMessageRole.Tool),
					}),
				);
			}
		}
		this.conversation_cache.messages.push(
			new AiChatCompiledMessage(id, {
				role: AiMessageRole.User,
				content: content || '',
			}),
		);
		return new AiChatConversation(id, this.conversation_cache.messages, assistant);
	}

	private getFullContext(context: string, role: AiMessageRole): string {
		if (role === AiMessageRole.System) return `## Initial Form State\n\n${context}`;
		return `## Updated Form State\n\n${context}`;
	}

	private retryAiSocket(assistant: AiAssistant, content: string | null, context: string | undefined): void {
		this.closeAiSocket();
		this.authService
			.refreshToken()
			.pipe(
				tap(() => {
					this.openAiSocket(assistant, content, context);
				}),
				catchError((refresh_error) => {
					this.authService.clearAuthCache();
					this.router.navigate(['/auth']);
					return throwError(() => refresh_error);
				}),
			)
			.subscribe();
	}

	public clearConversation(): void {
		this.conversation_cache = null;
		this.conversation_subject.next(null);
	}

	public updateConversation(conversation: AiChatConversation): void {
		this.conversation_cache = conversation;
	}
}
