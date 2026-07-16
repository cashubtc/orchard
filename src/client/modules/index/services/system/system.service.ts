/* Core Dependencies */
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {BehaviorSubject, catchError, map, Observable, of, tap, throwError} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
/* Native Dependencies */
import {SystemMetricSample} from '@client/modules/index/classes/system-metric.class';
import {SystemInfo} from '@client/modules/index/classes/system-info.class';
import {SYSTEM_METRICS_QUERY, SYSTEM_INFO_QUERY} from '@client/modules/index/services/system/system.queries';
import {SystemMetricsArgs, SystemMetricsResponse, SystemInfoResponse} from '@client/modules/index/types/system.types';

@Injectable({
	providedIn: 'root',
})
export class SystemService {
	private readonly http = inject(HttpClient);
	private readonly cache = inject(CacheService);
	private readonly apiService = inject(ApiService);

	public readonly CACHE_KEYS = {
		SYSTEM_METRICS: 'system_metrics',
		SYSTEM_INFO: 'system_info',
	};

	private readonly CACHE_DURATIONS: Record<string, number> = {
		[this.CACHE_KEYS.SYSTEM_METRICS]: 1 * 60 * 1000, // 1 minute
		[this.CACHE_KEYS.SYSTEM_INFO]: 60 * 60 * 1000, // 1 hour
	};

	private readonly system_metrics_subject: BehaviorSubject<SystemMetricSample[] | null>;
	private readonly system_info_subject: BehaviorSubject<SystemInfo | null>;

	private cached_metrics_args: string | null = null;

	constructor() {
		this.system_metrics_subject = this.cache.createCache<SystemMetricSample[]>(
			this.CACHE_KEYS.SYSTEM_METRICS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.SYSTEM_METRICS],
		);
		this.system_info_subject = this.cache.createCache<SystemInfo>(
			this.CACHE_KEYS.SYSTEM_INFO,
			this.CACHE_DURATIONS[this.CACHE_KEYS.SYSTEM_INFO],
		);
	}

	/** Loads stored host system metrics; cache is invalidated whenever the args change */
	public loadSystemMetrics(args: SystemMetricsArgs): Observable<SystemMetricSample[]> {
		const args_hash = JSON.stringify(args);
		if (args_hash !== this.cached_metrics_args) {
			this.clearMetricsCache();
			this.cached_metrics_args = args_hash;
		}

		if (this.system_metrics_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.SYSTEM_METRICS)) {
			return of(this.system_metrics_subject.value);
		}

		const query = getApiQuery(SYSTEM_METRICS_QUERY, args);

		return this.http.post<OrchardRes<SystemMetricsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.system_metrics;
			}),
			map((metrics) => metrics.map((metric) => new SystemMetricSample(metric))),
			tap((metrics) => {
				this.cache.updateCache(this.CACHE_KEYS.SYSTEM_METRICS, metrics);
				this.system_metrics_subject.next(metrics);
			}),
			catchError((error) => {
				console.error('Error loading system metrics:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Loads live host system information (static facts, cached long) */
	public loadSystemInfo(): Observable<SystemInfo> {
		if (this.system_info_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.SYSTEM_INFO)) {
			return of(this.system_info_subject.value);
		}

		const query = getApiQuery(SYSTEM_INFO_QUERY);

		return this.http.post<OrchardRes<SystemInfoResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.system_info;
			}),
			map((info) => new SystemInfo(info)),
			tap((info) => {
				this.cache.updateCache(this.CACHE_KEYS.SYSTEM_INFO, info);
				this.system_info_subject.next(info);
			}),
			catchError((error) => {
				console.error('Error loading system info:', error);
				return throwError(() => error);
			}),
		);
	}

	/** Drops the cached series so the next load re-fetches from the server */
	public clearMetricsCache(): void {
		this.cached_metrics_args = null;
		this.cache.clearCache(this.CACHE_KEYS.SYSTEM_METRICS);
	}
}
