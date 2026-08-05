/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, signal} from '@angular/core';
/* Native Dependencies */
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';

const PULSE_MS = 600;

@Component({
	selector: 'orc-ai-agent-chip',
	standalone: false,
	templateUrl: './ai-agent-chip.component.html',
	styleUrl: './ai-agent-chip.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAgentChipComponent implements OnDestroy {
	public readonly definition = input<AiAssistantDefinition | null>(null);
	public readonly icon_only = input<boolean>(false);
	public readonly full_name = input<boolean>(false);

	public readonly promoted = signal<boolean>(false);

	// Names read cleaner in the compact chip without the shared "Assistant" suffix
	public readonly display_name = computed(() => {
		const name = this.definition()?.name ?? '';
		return this.full_name() ? name : name.replace(/\s+Assistant$/, '');
	});

	private previous_name: string | null = null;
	private pulse_timeout?: ReturnType<typeof setTimeout>;

	constructor() {
		effect(() => {
			const name = this.definition()?.name ?? null;
			if (name === this.previous_name) return;
			// The first resolved agent is the page default, not a promotion.
			const first_resolve = this.previous_name === null;
			this.previous_name = name;
			if (!first_resolve && name) this.startPulse();
		});
	}

	/* *******************************************************
		Pulse
	******************************************************** */

	/** Runs the promotion pulse. Timer-driven rather than `animationend`, which
	 *  never fires under `prefers-reduced-motion` and would latch the class on. */
	private startPulse(): void {
		this.clearPulseTimeout();
		this.promoted.set(true);
		this.pulse_timeout = setTimeout(() => this.promoted.set(false), PULSE_MS);
	}

	private clearPulseTimeout(): void {
		if (this.pulse_timeout) clearTimeout(this.pulse_timeout);
		this.pulse_timeout = undefined;
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.clearPulseTimeout();
	}
}
