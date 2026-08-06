/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, signal, computed, inject} from '@angular/core';
import {
	Event,
	Router,
	ActivatedRoute,
	ActivatedRouteSnapshot,
	NavigationStart,
	NavigationEnd,
	NavigationCancel,
	NavigationError,
} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription, timer, EMPTY} from 'rxjs';
import {switchMap, catchError, filter, takeWhile} from 'rxjs/operators';
import {MatSidenav} from '@angular/material/sidenav';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {User} from '@client/modules/crew/classes/user.class';
import {BitcoinBlockchainInfo} from '@client/modules/bitcoin/classes/bitcoin-blockchain-info.class';
import {BitcoinBlockCount} from '@client/modules/bitcoin/classes/bitcoin-blockcount.class';
import {LightningInfo} from '@client/modules/lightning/classes/lightning-info.class';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {AiChatChunk} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {AiModel} from '@client/modules/ai/classes/ai-model.class';
import {AiChatConversation} from '@client/modules/ai/classes/ai-chat-conversation.class';
import {AiChatCompiledMessage} from '@client/modules/ai/classes/ai-chat-compiled-message.class';
import {AiFavorites} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Native Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Shared Dependencies */
import {AiAssistant, AiMessageRole} from '@shared/generated.types';

@Component({
	selector: 'orc-layout-interior',
	standalone: false,
	templateUrl: './layout-interior.component.html',
	styleUrl: './layout-interior.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutInteriorComponent implements OnInit, OnDestroy {
	// ── Injected dependencies ──
	private readonly configService = inject(ConfigService);
	private readonly crewService = inject(CrewService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly settingDeviceService = inject(SettingDeviceService);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly lightningService = inject(LightningService);
	private readonly mintService = inject(MintService);
	private readonly aiService = inject(AiService);
	private readonly eventService = inject(EventService);
	private readonly chartService = inject(ChartService);
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	@ViewChild('primarySidenav') primarySidenav!: MatSidenav;
	@ViewChild('aiSidenav') sidenav!: MatSidenav;

	// ── Public signals ──
	public ai_user_content = signal<string>('');
	public user_name = signal<string>('');
	public user_error = signal<boolean>(false);
	public ai_enabled = signal<boolean>(false);
	public ai_models = signal<AiModel[]>([]);
	public ai_conversation = signal<AiChatConversation | null>(null);
	public ai_revision = signal<number>(0);
	public ai_tool_calls = signal<number>(0);
	public ai_model = signal<string | null>(null);
	public ai_vendor = signal<string>('ollama');
	public ai_favorites = signal<AiFavorites>({ollama: [], openrouter: []});
	public active_chat = signal<boolean>(false);
	public active_section = signal<string>('');
	public active_sub_section = signal<string>('');
	public staged_assistant = this.aiService.staged_assistant;
	public pending_assistant = this.aiService.pending_assistant;
	public staged_assistant_definition = this.aiService.staged_assistant_definition;
	public active_event = signal<EventData | null>(null);
	public enabled_bitcoin = signal<boolean>(false);
	public enabled_lightning = signal<boolean>(false);
	public enabled_mint = signal<boolean>(false);
	public online_bitcoin = signal<boolean>(false);
	public online_lightning = signal<boolean>(false);
	public online_mint = signal<boolean>(false);
	public syncing_bitcoin = signal<boolean>(false);
	public syncing_lightning = signal<boolean>(false);
	public block_count = signal<number>(0);

	public overlayed = signal(false);
	public show_mobile_assistant = signal(false);
	public device_type = signal<DeviceType>('desktop');

	// ── Public computed signals ──
	public desktop_nav_open = computed(() => this.device_type() === 'desktop');
	public ai_sidenav_mode = computed(() => (this.device_type() === 'desktop' ? 'side' : 'over'));
	public show_mobile_nav = computed(() => !this.desktop_nav_open() && !this.show_mobile_assistant());

	public ai_actionable = computed(() => {
		if (this.active_chat()) return true;
		if (this.ai_user_content()) return true;
		return false;
	});

	// The log reflects the conversation's own assistant, while the input chip reflects the staged one
	public ai_assistant_definition = computed(() => {
		const assistant = this.ai_conversation()?.assistant;
		if (!assistant) return this.staged_assistant_definition();
		return this.aiService.getLoadedAssistant(assistant) ?? this.staged_assistant_definition();
	});

	// Set when the next message would hand off to another assistant and start a new conversation
	public ai_switching_assistant = computed(() => {
		const conversation = this.ai_conversation();
		if (!conversation || this.active_chat()) return null;
		if (conversation.assistant === this.staged_assistant()) return null;
		return this.staged_assistant_definition();
	});

	// ── Private properties ──
	private subscriptions: Subscription = new Subscription();
	private ai_initialized: boolean = false;
	private bitcoin_polling_active: boolean = false;

	constructor() {
		this.ai_enabled.set(this.settingAppService.getSetting('ai_enabled').value);
		this.ai_vendor.set(this.settingAppService.getSetting('ai_vendor').value);
		this.ai_favorites.set(this.settingDeviceService.getAiFavorites());
		this.enabled_bitcoin.set(this.configService.config.bitcoin.enabled);
		this.enabled_lightning.set(this.configService.config.lightning.enabled);
		this.enabled_mint.set(this.configService.config.mint.enabled);
	}

	/* *******************************************************
	   Initalization                      
	******************************************************** */

	ngOnInit(): void {
		this.crewService.loadUser().subscribe();
		this.subscriptions.add(this.getRouterSubscription());
		this.subscriptions.add(this.getOverlaySubscription());
		this.subscriptions.add(this.getEventSubscription());
		this.subscriptions.add(this.getUserSubscription());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.orchardOptionalInit();
	}

	private orchardOptionalInit(): void {
		if (this.enabled_bitcoin()) {
			this.bitcoin_polling_active = true;
			this.bitcoinService.loadBitcoinBlockchainInfo().subscribe();
			this.subscriptions.add(this.getBitcoinBlockchainInfoSubscription());
			this.subscriptions.add(this.getBitcoinBlockCountSubscription());
		}
		if (this.enabled_lightning()) {
			this.lightningService.loadLightningInfo().subscribe();
			this.subscriptions.add(this.getLightningInfoSubscription());
		}
		if (this.enabled_mint()) {
			this.mintService.loadMintInfo().subscribe();
			this.subscriptions.add(this.getMintInfoSubscription());
		}
		// if taproot go get the ids
		if (this.ai_enabled()) this.initAi();
	}

	private initAi(): void {
		if (this.ai_initialized) return;
		this.ai_initialized = true;
		this.aiService.syncAssistantDefinition();
		this.subscriptions.add(this.getAssistantSubscription());
		this.subscriptions.add(this.getActiveAiSubscription());
		this.subscriptions.add(this.getAiMessagesSubscription());
		this.subscriptions.add(this.getAiConversationSubscription());
		this.ai_model.set(this.settingDeviceService.getModel());
		if (!this.ai_model()) {
			this.aiService.getFunctionModel().subscribe((model) => {
				this.ai_model.set(model?.model || null);
				this.settingDeviceService.setModel(this.ai_model());
			});
		}
		this.getModels();
	}

	/* *******************************************************
		Subscriptions                      
	******************************************************** */

	private getRouterSubscription(): Subscription {
		return this.router.events.pipe(filter((event: Event) => 'routerEvent' in event || 'type' in event)).subscribe((event) => {
			const route_data = this.getRouteData(event);
			this.setSection(route_data);
			this.setSubSection(route_data);
			this.setAssistant(route_data);
		});
	}

	/**
	 * Subscribes to router events to control overlay visibility
	 * Shows overlay on navigation start, hides on end/cancel/error
	 * @returns {Subscription} router events subscription
	 */
	private getOverlaySubscription(): Subscription {
		return this.router.events.subscribe((event) => {
			if (event instanceof NavigationStart) {
				const segments = event.url.split('/').filter(Boolean);
				const index_routes = [undefined, 'crew'];
				const segment = index_routes.includes(segments[0]) ? 'index' : segments[0];
				if (segment !== this.active_section()) this.overlayed.set(true);
			}
			if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
				this.overlayed.set(false);
			}
		});
	}

	private getUserSubscription(): Subscription {
		return this.crewService.user$.subscribe({
			next: (user: User | null) => {
				if (!user) {
					this.user_name.set('dev user');
					this.user_error.set(true);
				} else {
					this.user_name.set(user.name);
					this.user_error.set(false);
				}
			},
		});
	}

	public getBreakpointSubscription(): Subscription {
		return this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium]).subscribe((result) => {
			if (result.breakpoints[Breakpoints.XSmall]) {
				this.device_type.set('mobile');
			} else if (result.breakpoints[Breakpoints.Small] || result.breakpoints[Breakpoints.Medium]) {
				this.device_type.set('tablet');
			} else {
				this.device_type.set('desktop');
			}
			if (this.desktop_nav_open()) this.show_mobile_assistant.set(false);
		});
	}

	private getBitcoinBlockchainInfoSubscription(): Subscription {
		return this.bitcoinService.bitcoin_blockchain_info$.subscribe({
			next: (info: BitcoinBlockchainInfo | null) => {
				if (info === undefined) return;
				this.online_bitcoin.set(info !== null ? true : false);
				this.syncing_bitcoin.set(info?.initialblockdownload ? true : false);
			},
			error: (error) => {
				console.error(error);
				this.online_bitcoin.set(false);
			},
		});
	}

	private getBitcoinBlockCountSubscription(): Subscription {
		return timer(0, 60000)
			.pipe(
				takeWhile(() => this.bitcoin_polling_active),
				switchMap(() =>
					this.bitcoinService.getBlockCount().pipe(
						catchError((error) => {
							console.error('Failed to fetch block count, polling stopped:', error);
							this.bitcoin_polling_active = false;
							return EMPTY;
						}),
					),
				),
			)
			.subscribe({
				next: async (block_count: BitcoinBlockCount) => {
					this.block_count.set(block_count.height);
				},
			});
	}

	private getLightningInfoSubscription(): Subscription {
		return this.lightningService.lightning_info$.subscribe({
			next: (info: LightningInfo | null) => {
				if (info === undefined) return;
				this.online_lightning.set(info !== null ? true : false);
				this.syncing_lightning.set(info?.synced_to_chain && info?.synced_to_graph ? false : true);
			},
			error: (error) => {
				console.error(error);
				this.online_lightning.set(false);
			},
		});
	}

	private getMintInfoSubscription(): Subscription {
		return this.mintService.mint_info$.subscribe({
			next: (info: MintInfo | null) => {
				if (info === undefined) return;
				this.online_mint.set(info !== null ? true : false);
			},
			error: (error) => {
				console.error(error);
				this.online_mint.set(false);
			},
		});
	}

	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			if (assistant === AiAssistant.Default) this.aiService.openAiSocket(assistant, content);
		});
	}

	private getActiveAiSubscription(): Subscription {
		return this.aiService.active$.subscribe((active: boolean) => {
			this.active_chat.set(active);
		});
	}

	private getAiMessagesSubscription(): Subscription {
		return this.aiService.messages$.subscribe((chunk: AiChatChunk) => {
			this.assembleMessages(chunk);
			this.countToolCalls(chunk);
			const conversation = this.ai_conversation();
			if (chunk.done && conversation) this.aiService.updateConversation(conversation);
		});
	}

	private getAiConversationSubscription(): Subscription {
		return this.aiService.conversation$.subscribe((conversation: AiChatConversation | null) => {
			this.ai_conversation.set(conversation);
			this.ai_revision.set(0);
			if (!conversation) this.ai_tool_calls.set(0);
		});
	}

	private getEventSubscription(): Subscription {
		return this.eventService.getActiveEvent().subscribe((event_data: EventData | null) => {
			this.active_event.set(event_data);
			if (this.active_section() === 'settings' && event_data?.type === 'SUCCESS') {
				this.ai_model.set(this.settingDeviceService.getModel());
				this.ai_vendor.set(this.settingAppService.getSetting('ai_vendor').value);
				this.ai_enabled.set(this.settingAppService.getSetting('ai_enabled').value);
				if (this.ai_enabled()) {
					if (this.ai_initialized) this.getModels();
					else this.initAi();
				}
			}
		});
	}

	/* *******************************************************
	   Events                      
	******************************************************** */

	public onSavePendingEvent(): void {
		this.active_event()!.confirmed = true;
		this.eventService.registerEvent(this.active_event());
	}

	public onCancelPendingEvent(): void {
		this.active_event()!.confirmed = false;
		this.eventService.registerEvent(this.active_event());
	}

	public onAbortSubscribedEvent(): void {
		this.active_event()!.confirmed = false;
		this.eventService.registerEvent(this.active_event());
	}

	/* *******************************************************
	   Routing                      
	******************************************************** */

	private getRouteData(event: Event): ActivatedRouteSnapshot['data'] | null {
		const router_event = 'routerEvent' in event ? event.routerEvent : event;
		if (router_event.type !== 1) return null;
		let route = this.route.root;
		while (route.firstChild) {
			route = route.firstChild;
		}
		return route.snapshot.data;
	}

	private setSection(route_data: ActivatedRouteSnapshot['data'] | null): void {
		if (!route_data) return;
		this.active_section.set(route_data['section'] || '');
	}

	private setSubSection(route_data: ActivatedRouteSnapshot['data'] | null): void {
		if (!route_data) return;
		this.active_sub_section.set(route_data['sub_section'] || '');
	}

	/* *******************************************************
	   Assistant                      
	******************************************************** */

	private setAssistant(route_data: ActivatedRouteSnapshot['data'] | null): void {
		if (!route_data) return;
		this.aiService.setRouteAssistant(route_data['assistant'] || AiAssistant.Default);
	}

	private getModels(): void {
		this.aiService.getAiModels().subscribe((models: AiModel[]) => {
			this.ai_models.set(models);
		});
	}

	public onCommand(): void {
		this.active_chat() ? this.stopChat() : this.startChat();
	}

	public onToggleLog(): void {
		this.sidenav.opened ? this.closeChatLog() : this.openChatLog();
		this.chartService.triggerResizeStart();
		setTimeout(() => {
			this.chartService.triggerResizeEnd();
		}, 400);
	}

	private startChat() {
		if (!this.ai_user_content()) return;
		const assistant = this.staged_assistant() || AiAssistant.Default;
		this.aiService.requestAssistant(assistant, this.ai_user_content());
		this.ai_user_content.set('');
	}

	public stopChat(): void {
		this.aiService.abortAiSocket(this.ai_conversation()?.id);
		const conversation = this.ai_conversation();
		if (conversation) this.aiService.updateConversation(conversation);
	}

	public onModelChange(model: string): void {
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.settingDeviceService.setModel(model);
		this.ai_model.set(model);
		this.eventService.registerEvent(
			new EventData({
				type: 'SUCCESS',
				message: 'Model updated!',
			}),
		);
	}

	public onFavoritesChange(favorites: AiFavorites): void {
		this.ai_favorites.set(favorites);
		this.settingDeviceService.setAiFavorites(favorites);
	}

	public onClearConversation(): void {
		this.closeChatLog();
		this.aiService.clearConversation();
		this.ai_tool_calls.set(0);
	}

	private assembleMessages(chunk: AiChatChunk): void {
		if (
			this.ai_conversation()!.messages.length > 0 &&
			this.ai_conversation()!.messages[this.ai_conversation()!.messages.length - 1].role !== AiMessageRole.Assistant
		) {
			this.ai_conversation()!.messages.push(new AiChatCompiledMessage(this.ai_conversation()!.id, chunk.message));
		} else {
			const last_message = this.ai_conversation()!.messages[this.ai_conversation()!.messages.length - 1];
			last_message.integrateChunk(chunk);
		}
		this.ai_revision.update((revision) => revision + 1);
	}

	private countToolCalls(chunk: AiChatChunk): void {
		this.ai_tool_calls.update((tool_calls) => tool_calls + (chunk.message.tool_calls?.length || 0));
	}

	private openChatLog(): void {
		this.sidenav.open();
	}

	public closeChatLog(): void {
		this.sidenav.close();
	}

	public onShowAssistant(): void {
		this.show_mobile_assistant.set(true);
	}

	public onHideAssistant(): void {
		this.show_mobile_assistant.set(false);
		if (this.active_event()?.type === 'PENDING') this.onCancelPendingEvent();
	}

	/* *******************************************************
	   Destroy                      
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
