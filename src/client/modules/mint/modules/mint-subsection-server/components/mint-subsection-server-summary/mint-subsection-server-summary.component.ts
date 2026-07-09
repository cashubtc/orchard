/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Native Dependencies */
import {MintMetricSnapshot} from '@client/modules/mint/classes/mint-metric.class';

@Component({
	selector: 'orc-mint-subsection-server-summary',
	standalone: false,
	templateUrl: './mint-subsection-server-summary.component.html',
	styleUrl: './mint-subsection-server-summary.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionServerSummaryComponent {
	public snapshots = input.required<MintMetricSnapshot[]>();
	public loading = input.required<boolean>();
	public pulsing = input<boolean>(false);

	public readonly cpu_percent = computed(() => this.getValue('process_cpu_usage_percent'));
	public readonly memory_bytes = computed(() => this.getValue('process_memory_bytes'));
	public readonly memory_percent = computed(() => this.getValue('process_memory_percent'));
	public readonly db_connections = computed(() => this.getValue('cdk_db_connections_active'));
	public readonly in_flight_requests = computed(() => this.getSum('cdk_mint_in_flight_requests'));
	public readonly errors_total = computed(() => this.getValue('cdk_errors_total'));

	public readonly auth_success_percent = computed(() => {
		const attempts = this.getValue('cdk_auth_attempts_total');
		const successes = this.getValue('cdk_auth_successes_total');
		if (!attempts) return null;
		return ((successes ?? 0) / attempts) * 100;
	});

	/* *******************************************************
		Data
	******************************************************** */

	/** Gets the value of the first sample of a metric family */
	private getValue(metric: string): number | null {
		const snapshot = this.snapshots().find((s) => s.metric === metric);
		return snapshot?.value ?? null;
	}

	/** Sums the values of all samples of a metric family */
	private getSum(metric: string): number | null {
		const samples = this.snapshots().filter((s) => s.metric === metric);
		if (samples.length === 0) return null;
		return samples.reduce((sum, sample) => sum + (sample.value ?? 0), 0);
	}

	/** Formats a byte value as MB/GB for display */
	public formatBytes(bytes: number | null): string {
		if (bytes === null) return '—';
		const mb = bytes / (1024 * 1024);
		if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
		return `${mb.toFixed(1)} MB`;
	}

	/** Formats a numeric value for display with an optional suffix */
	public formatNumber(value: number | null, suffix: string = ''): string {
		if (value === null) return '—';
		return `${Math.round(value * 100) / 100}${suffix}`;
	}
}
