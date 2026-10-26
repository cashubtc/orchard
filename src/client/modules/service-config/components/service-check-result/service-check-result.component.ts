/* Core Dependencies */
import {Component, ChangeDetectionStrategy, computed, effect, input, signal} from '@angular/core';

/* Vendor Dependencies */
import {ClipboardModule} from '@angular/cdk/clipboard';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Native Dependencies */
import {serviceModeLabel} from '@client/modules/service-config/helpers/service-config.helpers';

/* Shared Dependencies */
import type {OrchardConnectionCheck} from '@shared/generated.types';

@Component({
	selector: 'orc-service-check-result',
	imports: [ClipboardModule, MatButtonModule, MatIconModule],
	templateUrl: './service-check-result.component.html',
	styleUrl: './service-check-result.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCheckResultComponent {
	public readonly result = input.required<OrchardConnectionCheck>();
	public readonly copied = signal<boolean | null>(null);

	public readonly tone = computed<'success' | 'warning' | 'error'>(() =>
		!this.result().ok ? 'error' : this.result().warning ? 'warning' : 'success',
	);
	public readonly icon = computed<string>(() => (this.tone() === 'success' ? 'check_circle' : this.tone()));

	// Onboarding's Review explains setup mode, so a result doesn't label it
	public readonly mode_label = computed<string>(() => {
		const result = this.result();
		if (result.mode === 'setup') return '';
		if (result.mode === 'member' && result.mint_member_id != null && result.mint_member_count != null) {
			return `Federation member ${result.mint_member_id} of ${result.mint_member_count}`;
		}
		return serviceModeLabel(result.mode);
	});
	public readonly bitcoin_detail = computed<string>(() => {
		const result = this.result();
		if (!result.bitcoin_version && result.bitcoin_blocks == null) return '';
		return [
			result.bitcoin_version ? `Bitcoin Core ${result.bitcoin_version}` : 'Bitcoin Core',
			result.chain,
			result.bitcoin_blocks == null ? null : `block ${new Intl.NumberFormat().format(result.bitcoin_blocks)}`,
		]
			.filter(Boolean)
			.join(' · ');
	});
	// One short line each under the title: where Orchard dialled, then what it learned
	public readonly details = computed<string[]>(() => {
		const result = this.result();
		const chain =
			result.chain && !this.bitcoin_detail()
				? `${result.chain_match === true ? 'Same network as your Bitcoin node: ' : 'Network: '}${result.chain}`
				: '';
		return [result.context, this.bitcoin_detail(), chain, this.mode_label()].filter(Boolean);
	});

	constructor() {
		effect(() => {
			this.result();
			this.copied.set(null);
		});
	}
}
