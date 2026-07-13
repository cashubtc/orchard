/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {round2} from '@server/modules/math/round';
/* Native Dependencies */
import {SystemMetricsService} from '@server/modules/system/metrics/sysmetrics.service';
import {SystemMetrics} from '@server/modules/system/metrics/sysmetrics.entity';
import {SystemMetric, SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
import {bucketMinMaxAvg} from '@server/modules/system/metrics/sysmetrics.helpers';
/* Local Dependencies */
import {OrchardSystemMetrics} from './sysmetrics.model';

interface SystemMetricsArgs {
	date_start?: number;
	date_end?: number;
	interval?: SystemMetricsInterval;
	timezone?: string;
	metrics?: SystemMetric[];
}

@Injectable()
export class ApiSystemMetricsService {
	private readonly logger = new Logger(ApiSystemMetricsService.name);

	constructor(
		private systemMetricsService: SystemMetricsService,
		private errorService: ErrorService,
	) {}

	/**
	 * Gets system metrics data with optional interval aggregation
	 */
	async getMetrics(tag: string, args: SystemMetricsArgs): Promise<OrchardSystemMetrics[]> {
		try {
			const now = DateTime.utc().toUnixInteger();
			const interval = args.interval ?? SystemMetricsInterval.minute;
			const date_start = args.date_start ?? DateTime.utc().minus({days: 90}).toUnixInteger();
			const date_end = args.date_end ?? now;
			const metrics = args.metrics ?? Object.values(SystemMetric);

			const data = await this.systemMetricsService.getMetrics(date_start, date_end, metrics);

			return this.aggregateByInterval(data, interval, args.timezone);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.SystemMetricsError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Aggregates raw metric data by the requested interval
	 */
	private aggregateByInterval(data: SystemMetrics[], interval: SystemMetricsInterval, timezone?: string): OrchardSystemMetrics[] {
		if (interval === SystemMetricsInterval.minute) {
			return data.map((d) => new OrchardSystemMetrics(d.metric as SystemMetric, d.value, d.date, d.value, d.value));
		}

		const tz = timezone ?? 'UTC';
		const by_metric = new Map<SystemMetric, SystemMetrics[]>();
		for (const d of data) {
			const metric = d.metric as SystemMetric;
			const rows = by_metric.get(metric);
			if (rows) rows.push(d);
			else by_metric.set(metric, [d]);
		}

		const out: OrchardSystemMetrics[] = [];
		for (const [metric, rows] of Array.from(by_metric.entries())) {
			for (const b of bucketMinMaxAvg(rows, interval, tz)) {
				out.push(new OrchardSystemMetrics(metric, round2(b.avg), b.date, round2(b.min), round2(b.max)));
			}
		}

		return out.sort((a, b) => a.date - b.date);
	}
}
