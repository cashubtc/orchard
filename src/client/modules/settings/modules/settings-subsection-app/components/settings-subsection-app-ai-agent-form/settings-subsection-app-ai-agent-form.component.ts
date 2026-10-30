/* Core Dependencies */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit, signal, computed} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
import {firstValueFrom, Subscription, filter} from 'rxjs';
/* Application Dependencies */
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiAgent} from '@client/modules/ai/classes/ai-agent.class';
import {AiModel} from '@client/modules/ai/classes/ai-model.class';
import {AiAgentTool} from '@client/modules/ai/classes/ai-agent-tool.class';
import {AiAgentDefault} from '@client/modules/ai/classes/ai-agent-default.class';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {buildToolSummary} from '@client/modules/ai/helpers/ai-tool-summary.helper';
import {AiFavorites} from '@client/modules/cache/services/local-storage/local-storage.types';
import {FormPanelRef, FORM_PANEL_DATA} from '@client/modules/form/services/form-panel';
import {FormCronBuilderComponent} from '@client/modules/form/components/form-cron-builder/form-cron-builder.component';
import {Config} from '@client/modules/config/types/config';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {ParsedAppSettings} from '@client/modules/settings/types/setting-app.types';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
/* Native Dependencies */
import {AgentFormMode, ToolSummary} from '@client/modules/settings/modules/settings-subsection-app/types/settings-subsection-app.types';
/* Shared Dependencies */
import {AiAssistant, AssistantToolName} from '@shared/generated.types';

@Component({
	selector: 'orc-settings-subsection-app-ai-agent-form',
	standalone: false,
	templateUrl: './settings-subsection-app-ai-agent-form.component.html',
	styleUrl: './settings-subsection-app-ai-agent-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSubsectionAppAiAgentFormComponent implements OnInit, OnDestroy {
	/* ── Injected dependencies ── */
	private readonly panelRef = inject(FormPanelRef);
	private readonly aiService = inject(AiService);
	private readonly dialog = inject(MatDialog);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly settingDeviceService = inject(SettingDeviceService);
	public readonly data: {
		mode: AgentFormMode;
		agent: AiAgent | null;
		models: AiModel[];
		tools: AiAgentTool[];
		device_type: DeviceType;
		vendor: string;
		favorites: AiFavorites;
		fullscreen_system_message: boolean;
		app_settings: ParsedAppSettings | null;
		config: Config | null;
	} = inject(FORM_PANEL_DATA);

	/* ── Public properties ── */
	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;

	/* ── Public signals ── */
	public ai_favorites = signal<AiFavorites>({ollama: [], openrouter: []});
	public focused_name = signal<boolean>(false);
	public focused_description = signal<boolean>(false);
	public focused_system_message = signal<boolean>(false);
	public help_name = signal<boolean>(false);
	public help_description = signal<boolean>(false);
	public help_model = signal<boolean>(false);
	public is_keyed_agent = signal<boolean>(false);
	public is_default_system_message = signal<boolean>(false);
	public is_default_tools = signal<boolean>(false);
	public fullscreen_system_message = signal<boolean>(false);
	public tool_gui = signal<{summary: ToolSummary; tools: {name: string; selected: boolean}[]}[]>([]);
	public tools_available = signal<boolean>(false);
	public submitted = signal<boolean>(false);

	/* ── Public computed signals ── */
	public readonly tool_map = computed(() => {
		return new Map(this.data.tools.map((tool) => [tool.name, tool]));
	});
	public readonly available_tool_count = computed(() => {
		return this.tool_gui().reduce((sum, entry) => sum + entry.tools.filter((t) => !t.selected).length, 0);
	});
	public readonly form_title = computed(() => {
		if (this.data.mode === 'jobedit') return 'Agent job settings';
		if (this.data.mode === 'jobcreate') return 'New agent job';
		return 'Agent settings';
	});
	/* -- Public properties ── */
	public form: FormGroup;

	/* ── Private fields ── */
	private defaults: AiAgentDefault | null = null;
	private subscriptions = new Subscription();

	constructor() {
		this.ai_favorites.set(this.data.favorites);
		// The fullscreen editor overlays the side panel; a sheet keeps the inline editor
		this.fullscreen_system_message.set(this.data.fullscreen_system_message && !this.sheet);
		this.is_keyed_agent.set(this.data.agent !== null && this.data.agent?.agent_key !== null);
		switch (this.data.mode) {
			case 'groundskeeper':
				this.form = this.getAgentForm();
				break;
			case 'jobedit':
				this.form = this.getJobEditForm();
				break;
			default:
				this.tools_available.set(true);
				this.form = this.getJobCreateForm();
				break;
		}
		this.tool_gui.set(this.getToolGui());
		this.subscriptions.add(this.subToolGui());
		if (this.is_keyed_agent()) {
			this.subscriptions.add(this.subSystemMessage());
			this.subscriptions.add(this.subToolDefaults());
		}
		this.aiService.setAssistantOverride(AiAssistant.SettingsAgent);
		this.subscriptions.add(this.subAssistantRequests());
		this.subscriptions.add(this.subAssistantToolCalls());
	}

	/* *******************************************************
		Initialize
	******************************************************** */

	async ngOnInit(): Promise<void> {
		if (!this.data.agent || !this.data.agent.agent_key) return;
		await this.getAiDefaults();
		this.is_default_system_message.set(this.defaults?.system_message === this.form.get('system_message')?.value);
		this.is_default_tools.set(JSON.stringify(this.data.agent?.tools ?? []) === JSON.stringify(this.defaults?.tools ?? []));
	}

	private getAgentForm(): FormGroup {
		if (!this.data.agent || !this.data.agent.agent_key) return new FormGroup({});
		return new FormGroup({
			name: new FormControl(this.data.agent.name, [Validators.required, Validators.maxLength(64)]),
			description: new FormControl(this.data.agent.description, [Validators.required, Validators.maxLength(256)]),
			model: new FormControl(this.data.agent.model, [Validators.required]),
			system_message: new FormControl(this.data.agent.system_message, [Validators.required, Validators.maxLength(4096)]),
			tools: new FormControl(this.data.agent.tools ?? [], [Validators.required]),
		});
	}

	private getJobEditForm(): FormGroup {
		if (!this.data.agent) return new FormGroup({});
		return new FormGroup({
			name: new FormControl(this.data.agent.name, [Validators.required, Validators.maxLength(64)]),
			description: new FormControl(this.data.agent.description, [Validators.required, Validators.maxLength(256)]),
			active: new FormControl(this.data.agent.active),
			model: new FormControl(this.data.agent.model, [Validators.required]),
			system_message: new FormControl(this.data.agent.system_message, [Validators.required, Validators.maxLength(4096)]),
			tools: new FormControl(this.data.agent.tools ?? [], [Validators.required]),
			schedules: new FormControl(this.data.agent.schedules ?? [], [Validators.required]),
		});
	}

	private getJobCreateForm(): FormGroup {
		return new FormGroup({
			name: new FormControl(null, [Validators.required, Validators.maxLength(64)]),
			description: new FormControl(null, [Validators.required, Validators.maxLength(256)]),
			active: new FormControl(true),
			model: new FormControl(null, [Validators.required]),
			system_message: new FormControl(null, [Validators.required, Validators.maxLength(4096)]),
			tools: new FormControl(null, [Validators.required]),
			schedules: new FormControl(null, [Validators.required]),
		});
	}

	/* *******************************************************
		Data
	******************************************************** */

	private async getAiDefaults(): Promise<void> {
		if (!this.data.agent || !this.data.agent.agent_key) return;
		this.defaults = await firstValueFrom(this.aiService.getAiAgentDefaults(this.data.agent.agent_key));
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	/** Watches system_message control and updates is_default signal */
	private subSystemMessage(): Subscription | undefined {
		return this.form.get('system_message')?.valueChanges.subscribe((value) => {
			this.is_default_system_message.set(value === this.defaults?.system_message);
		});
	}

	/** Watches tools control and updates is_default signal */
	private subToolDefaults(): Subscription | undefined {
		return this.form.get('tools')?.valueChanges.subscribe((value) => {
			this.is_default_tools.set(JSON.stringify(value) === JSON.stringify(this.defaults?.tools));
		});
	}

	/** Refreshes tool GUI state whenever the tools control value changes */
	private subToolGui(): Subscription | undefined {
		return this.form.get('tools')?.valueChanges.subscribe(() => {
			this.tool_gui.set(this.getToolGui());
		});
	}

	/** Listens for assistant requests and hires the agent settings assistant */
	private subAssistantRequests(): Subscription {
		return this.aiService.assistant_requests$
			.pipe(filter(({assistant}) => assistant === AiAssistant.SettingsAgent))
			.subscribe(({content}) => {
				this.hireAgentSettingsAssistant(content);
			});
	}

	/** Listens for tool calls from the assistant and executes them */
	private subAssistantToolCalls(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
		});
	}

	/* *******************************************************
		AI
	******************************************************** */

	/** Activates the agent settings assistant with current form context */
	private hireAgentSettingsAssistant(content: string | null): void {
		const context = this.buildFormContext();
		this.aiService.openAiSocket(AiAssistant.SettingsAgent, content, context);
	}

	/** Serializes current form state and available options for the assistant */
	private buildFormContext(): string {
		let context = `* **Form Mode:** ${this.data.mode}\n`;
		context += `* **Name:** ${this.form.get('name')?.value || 'Not set'}\n`;
		context += `* **Description:** ${this.form.get('description')?.value || 'Not set'}\n`;
		context += `* **Model:** ${this.form.get('model')?.value || 'Not set'}\n`;
		const system_message = this.form.get('system_message')?.value;
		context += `* **System Message:** ${system_message ? system_message.substring(0, 200) + (system_message.length > 200 ? '...' : '') : 'Not set'}\n`;
		if (this.form.get('active')) {
			context += `* **Active:** ${this.form.get('active')?.value}\n`;
		}
		const tools: string[] = this.form.get('tools')?.value ?? [];
		context += `* **Selected Tools:** ${tools.length > 0 ? tools.join(', ') : 'None'}\n`;
		if (this.form.get('schedules')) {
			const schedules: string[] = this.form.get('schedules')?.value ?? [];
			context += `* **Schedules:** ${schedules.length > 0 ? schedules.join(', ') : 'None'}\n`;
		}
		const favorite_ids = new Set(this.data.vendor === 'openrouter' ? this.data.favorites.openrouter : this.data.favorites.ollama);
		const favorite_models = this.data.models.filter((m) => favorite_ids.has(m.model));
		const models_for_context = favorite_models.length > 0 ? favorite_models : this.data.models;
		context += `* **Available Models:** ${models_for_context.map((m) => m.name).join(', ')}\n`;
		const banned_names = this.getBannedToolNames();
		const tools_by_category = new Map<string, string[]>();
		for (const tool of this.data.tools) {
			if (banned_names.has(tool.name)) continue;
			const category = tool.category ?? 'uncategorized';
			const list = tools_by_category.get(category) ?? [];
			list.push(tool.name);
			tools_by_category.set(category, list);
		}
		context += `* **Available Tools by Category:**\n`;
		for (const [category, names] of tools_by_category) {
			context += `  * **${category}:** ${names.join(', ')}\n`;
		}
		return context;
	}

	/** Executes the tool call from the AI assistant */
	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		let handled = true;
		if (tool_call.function.name === AssistantToolName.AgentNameUpdate) {
			this.form.get('name')?.setValue(tool_call.function.arguments.name);
			this.form.get('name')?.markAsDirty();
		} else if (tool_call.function.name === AssistantToolName.AgentDescriptionUpdate) {
			this.form.get('description')?.setValue(tool_call.function.arguments.description);
			this.form.get('description')?.markAsDirty();
		} else if (tool_call.function.name === AssistantToolName.AgentModelUpdate) {
			this.form.get('model')?.setValue(tool_call.function.arguments.model);
			this.form.get('model')?.markAsDirty();
		} else if (tool_call.function.name === AssistantToolName.AgentSystemMessageUpdate) {
			this.form.get('system_message')?.setValue(tool_call.function.arguments.system_message);
			this.form.get('system_message')?.markAsDirty();
		} else if (tool_call.function.name === AssistantToolName.AgentToolsUpdate) {
			this.setToolsFromAssistant(tool_call.function.arguments.tools);
		} else if (tool_call.function.name === AssistantToolName.AgentSchedulesUpdate && this.form.get('schedules')) {
			this.form.get('schedules')?.setValue(tool_call.function.arguments.schedules);
			this.form.get('schedules')?.markAsDirty();
		} else if (tool_call.function.name === AssistantToolName.AgentActiveUpdate && this.form.get('active')) {
			this.form.get('active')?.setValue(tool_call.function.arguments.active);
			this.form.get('active')?.markAsDirty();
		} else {
			handled = false;
		}
		if (!handled) return;
		this.tool_gui.set(this.getToolGui());
		this.cdr.detectChanges();
	}

	/** Validates and sets tools from assistant, filtering invalid and banned names */
	private setToolsFromAssistant(tool_names: string[]): void {
		const valid_names = new Set(this.data.tools.map((t) => t.name));
		const banned_tool_names = this.getBannedToolNames();
		const filtered = (tool_names ?? []).filter((name) => valid_names.has(name) && !banned_tool_names.has(name));
		this.form.get('tools')?.setValue(filtered);
		this.form.get('tools')?.markAsDirty();
	}

	/** Returns the set of tool names banned for the current form mode */
	private getBannedToolNames(): Set<string> {
		if (this.data.mode !== 'groundskeeper') return new Set<string>();
		return new Set(this.data.tools.filter((t) => this.GROUNDSKEEPER_BANNED_CATEGORIES.has(t.category ?? '')).map((t) => t.name));
	}

	/* *******************************************************
		Form
	******************************************************** */

	/** Categories banned from the groundskeeper agent */
	private readonly GROUNDSKEEPER_BANNED_CATEGORIES = new Set(['memory', 'message']);

	/** Groups all tools by category with a selected flag for stable ordering */
	private getToolGui(): {summary: ToolSummary; tools: {name: string; selected: boolean}[]}[] {
		const tool_names: string[] = this.form.get('tools')?.value ?? [];
		const agent = new AiAgent({tools: tool_names} as any);
		const summaries = buildToolSummary(agent, this.data.tools, this.data.app_settings, this.data.config);
		const banned = this.data.mode === 'groundskeeper' ? this.GROUNDSKEEPER_BANNED_CATEGORIES : null;
		const selected_set = new Set(tool_names);
		const tools_by_category = new Map<string, {name: string; selected: boolean}[]>();
		for (const tool of this.data.tools) {
			const category = tool.category ?? 'Uncategorized';
			if (banned?.has(category)) continue;
			const list = tools_by_category.get(category) ?? [];
			list.push({name: tool.name, selected: selected_set.has(tool.name)});
			tools_by_category.set(category, list);
		}
		return summaries
			.filter((summary) => !banned?.has(summary.category))
			.map((summary) => ({
				summary,
				tools: tools_by_category.get(summary.category) ?? [],
			}));
	}

	/* *******************************************************
		Actions
	******************************************************** */

	/** Closes the panel with save payload for the parent to handle */
	public onSave(): void {
		this.submitted.set(true);
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		const timezone = this.settingDeviceService.getTimezone();
		if (this.data.mode === 'jobcreate') {
			this.panelRef.close({mode: 'jobcreate', values: {...this.form.value, schedule_tz: timezone}});
			return;
		}
		if (!this.data.agent) return;
		const dirty_values: Record<string, unknown> = {};
		for (const key of Object.keys(this.form.controls)) {
			const control = this.form.get(key);
			if (control?.dirty) {
				dirty_values[key] = control.value;
			}
		}
		if (Object.keys(dirty_values).length === 0) {
			this.panelRef.close();
			return;
		}
		if (dirty_values['schedules'] !== undefined) {
			dirty_values['schedule_tz'] = timezone;
		}
		this.panelRef.close({mode: this.data.mode, id: this.data.agent.id, values: dirty_values});
	}

	public onClose(): void {
		this.panelRef.close();
	}

	/** Reverts a single form field to its original value and marks it pristine */
	public onCancel(event: Event, field: string): void {
		event.preventDefault();
		const control = this.form.get(field);
		if (!control) return;
		const original = (this.data.agent as any)?.[field] ?? null;
		control.setValue(original);
		control.markAsPristine();
	}

	public onActiveChange(active: boolean): void {
		this.form.get('active')?.setValue(active);
		this.form.get('active')?.markAsDirty();
	}

	public onResetSystemMessage(): void {
		this.form.get('system_message')?.setValue(this.defaults?.system_message ?? '');
		this.form.get('system_message')?.markAsDirty();
	}

	public onResetTools(): void {
		this.form.get('tools')?.setValue(this.defaults?.tools ?? []);
		this.form.get('tools')?.markAsDirty();
	}

	public onFullscreenSystemMessage(): void {
		this.fullscreen_system_message.set(!this.fullscreen_system_message());
	}

	public onModelChange(model: string): void {
		this.form.get('model')?.setValue(model);
		this.form.get('model')?.markAsDirty();
	}

	/** Persists updated AI model favorites to local storage */
	public onFavoritesChange(favorites: AiFavorites): void {
		this.ai_favorites.set(favorites);
		this.settingDeviceService.setAiFavorites(favorites);
	}

	/** Opens the cron builder dialog to add a new schedule */
	public onAddSchedule(): void {
		const ref = this.dialog.open(FormCronBuilderComponent, {
			data: {cron: null},
		});
		this.subscriptions.add(
			ref.afterClosed().subscribe((cron: string | undefined) => {
				if (!cron) return;
				const schedules: string[] = this.form.get('schedules')?.value ?? [];
				this.form.get('schedules')?.setValue([...schedules, cron]);
				this.form.get('schedules')?.markAsDirty();
				this.cdr.markForCheck();
			}),
		);
	}

	/** Opens the cron builder dialog to edit an existing schedule */
	public onEditSchedule(index: number): void {
		const schedules: string[] = this.form.get('schedules')?.value ?? [];
		const ref = this.dialog.open(FormCronBuilderComponent, {
			data: {cron: schedules[index]},
		});
		this.subscriptions.add(
			ref.afterClosed().subscribe((cron: string | undefined) => {
				if (!cron) return;
				const updated = [...schedules];
				updated[index] = cron;
				this.form.get('schedules')?.setValue(updated);
				this.form.get('schedules')?.markAsDirty();
				this.cdr.markForCheck();
			}),
		);
	}

	/** Removes a schedule at the given index */
	public onDeleteSchedule(index: number): void {
		const schedules: string[] = this.form.get('schedules')?.value ?? [];
		this.form.get('schedules')?.setValue(schedules.filter((_: string, i: number) => i !== index));
		this.form.get('schedules')?.markAsDirty();
	}

	/** Removes a tool from the selected tools list */
	public onRemoveTool(tool_name: string): void {
		const tools: string[] = this.form.get('tools')?.value ?? [];
		this.form.get('tools')?.setValue(tools.filter((t: string) => t !== tool_name));
		this.form.get('tools')?.markAsDirty();
	}

	public onAddTool(tool_name: string): void {
		const tools: string[] = this.form.get('tools')?.value ?? [];
		this.form.get('tools')?.setValue([...tools, tool_name]);
		this.form.get('tools')?.markAsDirty();
	}

	public onToggleToolsAvailable(): void {
		this.tools_available.set(!this.tools_available());
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.aiService.clearAssistantOverride();
		this.subscriptions.unsubscribe();
	}
}
