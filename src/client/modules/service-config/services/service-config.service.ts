/* Core Dependencies */
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/* Vendor Dependencies */
import {map, switchMap, of, catchError, type Observable} from 'rxjs';

/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import type {OrchardRes} from '@client/modules/api/types/api.types';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {ConfigService} from '@client/modules/config/services/config.service';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';

/* Native Dependencies */
import {
	CONFIGURATIONS_QUERY,
	TEST_MUTATION,
	SAVE_MUTATION,
	REMOVE_MUTATION,
} from '@client/modules/service-config/services/service-config.queries';

/* Shared Dependencies */
import {
	ServiceKind,
	type ServiceConnectionInput,
	type OrchardServiceConfiguration,
	type OrchardConnectionCheck,
} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class ServiceConfigService {
	private readonly http = inject(HttpClient);
	private readonly api = inject(ApiService);
	private readonly configService = inject(ConfigService);
	private readonly cacheService = inject(CacheService);
	private readonly federationService = inject(FederationService);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly lightningService = inject(LightningService);
	private readonly mintService = inject(MintService);

	/* *******************************************************
        Connections
    ******************************************************** */

	/** Load administrator-only form values. */
	public load(): Observable<OrchardServiceConfiguration[]> {
		return this.request<{service_configurations: OrchardServiceConfiguration[]}>(CONFIGURATIONS_QUERY).pipe(
			map((data) => data.service_configurations),
		);
	}

	/** Test a draft without changing runtime state. */
	public test(input: ServiceConnectionInput): Observable<OrchardConnectionCheck> {
		return this.request<{service_connection_test: OrchardConnectionCheck}>(TEST_MUTATION, {input}).pipe(
			map((data) => data.service_connection_test),
		);
	}

	/** Save and update both navigation and cached federation mode without a reload. */
	public save(input: ServiceConnectionInput, save_unreachable = false): Observable<OrchardConnectionCheck> {
		return this.request<{service_configuration_save: OrchardConnectionCheck}>(SAVE_MUTATION, {input, save_unreachable}).pipe(
			map((data) => data.service_configuration_save),
			switchMap((result) => (result.ok || save_unreachable ? this.refresh(input.service).pipe(map(() => result)) : of(result))),
		);
	}

	/** Disconnect one integration and refresh runtime flags. */
	public remove(service: ServiceKind): Observable<void> {
		return this.request<{service_configuration_remove: boolean}>(REMOVE_MUTATION, {service}).pipe(
			switchMap(() => this.refresh(service)),
		);
	}

	/** Invalidate the changed service's node data before requesting flags for the new connection. */
	private refresh(service: ServiceKind): Observable<void> {
		const cache_keys = {
			[ServiceKind.Bitcoin]: this.bitcoinService.CACHE_KEYS,
			[ServiceKind.Lightning]: this.lightningService.CACHE_KEYS,
			[ServiceKind.Mint]: this.mintService.CACHE_KEYS,
		}[service];
		for (const key of Object.values(cache_keys)) this.cacheService.clearCache(key);
		return this.configService.loadStatus(true).pipe(
			switchMap(() =>
				service === ServiceKind.Mint
					? this.federationService.loadMode(true).pipe(
							map(() => undefined),
							catchError(() => of(undefined)),
						)
					: of(undefined),
			),
		);
	}

	/** Execute a typed operation and preserve server diagnostics. */
	private request<T>(query: string, variables: object = {}): Observable<T> {
		return this.http.post<OrchardRes<T>>(this.api.api, getApiQuery(query, variables)).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
		);
	}
}
