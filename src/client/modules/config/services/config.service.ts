/* Core Dependencies */
import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {map, of, shareReplay, tap, finalize, type Observable} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import type {OrchardRes} from '@client/modules/api/types/api.types';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {SERVICE_STATUS_QUERY} from '@client/modules/config/services/config.queries';
import type {Config} from '@client/modules/config/types/config';
/* Shared Dependencies */
import type {OrchardServiceStatus} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class ConfigService {
	private readonly http = inject(HttpClient);

	private loaded = false;
	private request_version = 0;
	private pending: Observable<void> | null = null;
	private readonly configuration = signal<Config>((window as unknown as {__config__: Config}).__config__);

	/* *******************************************************
        Runtime configuration
    ******************************************************** */

	/** Preserve the established config shape while making reads reactive. */
	public get config(): Config {
		return this.configuration();
	}

	/** Allow configuration replacement for embedded hosts and tests. */
	public set config(config: Config) {
		this.configuration.set(config);
	}

	/** Load authenticated runtime flags before entering sections, or refresh after a save. */
	public loadStatus(refresh = false): Observable<void> {
		if (refresh) {
			this.request_version++;
			this.pending = null;
		}
		if (this.pending) return this.pending;
		if (!refresh && this.loaded) return of(undefined);
		const version = this.request_version;
		const config = this.config;
		this.pending = this.http
			.post<OrchardRes<{service_status: OrchardServiceStatus[]}>>(
				`${config.api.proxy}/${config.api.path}`,
				getApiQuery(SERVICE_STATUS_QUERY),
			)
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.service_status;
				}),
				tap((services) => {
					if (version === this.request_version) this.applyStatus(services);
				}),
				map(() => undefined),
				finalize(() => {
					if (version === this.request_version) this.pending = null;
				}),
				shareReplay({bufferSize: 1, refCount: false}),
			);
		return this.pending;
	}

	/** Write server flags into the config shape the rest of the client already reads. */
	private applyStatus(services: OrchardServiceStatus[]): void {
		const current = this.config;
		const bitcoin = services.find((service) => service.service === 'bitcoin');
		const lightning = services.find((service) => service.service === 'lightning');
		const mint = services.find((service) => service.service === 'mint');
		this.configuration.set({
			...current,
			bitcoin: {...current.bitcoin, enabled: bitcoin?.enabled ?? false},
			lightning: {...current.lightning, enabled: lightning?.enabled ?? false},
			mint: {
				...current.mint,
				enabled: mint?.enabled ?? false,
				type: mint?.type ?? 'cdk',
				database: mint?.database ?? false,
				public_api: mint?.public_api ?? false,
				database_type: mint?.database_type ?? 'sqlite',
				metrics: mint?.metrics ?? false,
			},
		});
		this.loaded = true;
	}
}
