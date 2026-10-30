/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, OnDestroy, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
/* Vendor Dependencies */
import {marked} from 'marked';
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiAgentRun} from '@client/modules/ai/classes/ai-agent-run.class';
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';

@Component({
	selector: 'orc-settings-subsection-app-ai-job-execute',
	standalone: false,
	templateUrl: './settings-subsection-app-ai-job-execute.component.html',
	styleUrl: './settings-subsection-app-ai-job-execute.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSubsectionAppAiJobExecuteComponent implements OnInit, OnDestroy {
	// ── Injected dependencies ──
	private readonly aiService = inject(AiService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly panelRef = inject(FormPanelRef);
	public readonly data: {id: string; name: string} = inject(FORM_PANEL_DATA);

	// ── Public properties ──
	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;

	// ── Public signals ──
	public readonly loading = signal<boolean>(true);
	public readonly error = signal<string | null>(null);
	public readonly marked_result = signal<string | null>(null);
	public readonly run_result = signal<AiAgentRun | null>(null);
	public readonly elapsed_seconds = signal<number>(0);

	// ── Public computed signals ──
	public readonly groundskeeper_active = computed(() => this.loading());
	public readonly groundskeeper_running = computed(() => this.loading());
	public readonly groundskeeper_state = computed<'error' | 'success' | null>(() => {
		if (this.loading()) return null;
		if (this.error()) return 'error';
		return 'success';
	});

	// ── Private properties ──
	private timer_id: ReturnType<typeof setInterval> | null = null;

	// ── Lifecycle: Init ──
	ngOnInit(): void {
		this.startTimer();
		this.aiService
			.executeAiAgent(this.data.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (run) => {
					this.stopTimer();
					this.run_result.set(run);
					if (run.error) {
						this.error.set(run.error);
						this.loading.set(false);
					} else if (run.result) {
						this.parseResult(run.result);
					} else {
						this.loading.set(false);
					}
				},
				error: (err) => {
					this.stopTimer();
					this.error.set(err?.message ?? 'An unexpected error occurred');
					this.loading.set(false);
				},
			});
	}

	/* *******************************************************
		Timer
	******************************************************** */

	/** Starts the elapsed time counter */
	private startTimer(): void {
		this.timer_id = setInterval(() => {
			this.elapsed_seconds.update((v) => v + 1);
		}, 1000);
	}

	/** Stops the elapsed time counter */
	private stopTimer(): void {
		if (this.timer_id !== null) {
			clearInterval(this.timer_id);
			this.timer_id = null;
		}
	}

	/** Formats seconds into MM:SS display */
	public formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}

	/** Formats a duration in seconds into a human-readable string */
	public formatDuration(run: AiAgentRun): string {
		if (!run.completed_at) return 'N/A';
		const duration_seconds = run.completed_at - run.started_at;
		if (duration_seconds < 60) return `${duration_seconds}s`;
		const mins = Math.floor(duration_seconds / 60);
		const secs = duration_seconds % 60;
		return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	}

	/* *******************************************************
		Actions
	******************************************************** */

	/** Closes the side panel */
	public onClose(): void {
		this.panelRef.close();
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Parses markdown result and updates signals */
	private async parseResult(result: string): Promise<void> {
		try {
			const parsed = await marked.parse(result);
			this.marked_result.set(parsed);
		} catch {
			this.error.set('Failed to parse result');
		}
		this.loading.set(false);
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.stopTimer();
	}
}
