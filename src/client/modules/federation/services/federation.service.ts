/* Core Dependencies */
import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/* Vendor Dependencies */
import {catchError, map, of, shareReplay, tap, throwError, type Observable} from 'rxjs';

/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {ConfigService} from '@client/modules/config/services/config.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import type {OrchardRes} from '@client/modules/api/types/api.types';

import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';

/* Native Dependencies */
import {FEDERATION_MODE_QUERY} from '@client/modules/federation/services/federation.queries';
import type {FederationModeResponse} from '@client/modules/federation/types/federation.types';

/* Shared Dependencies */
import type {OrchardFederationMode} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class FederationService {
	private readonly storage = inject(LocalStorageService);
	private readonly http = inject(HttpClient);
	private readonly apiService = inject(ApiService);
	private readonly configService = inject(ConfigService);

	public readonly backup_warning = signal<string | null>(this.storage.getItem<string>('v0.federation.backup.warning'));
	public readonly backup_federation_id = signal<string | null>(this.storage.getItem<string>('v0.federation.backup.id'));
	public readonly mode = signal<string | null>(null);
	public readonly details = signal<string | null>(null);
	public readonly standalone_actions = computed(() => this.configService.config.mint.type !== 'cdk' || this.mode() === 'standalone');
	public readonly is_member = computed(() => this.mode() === 'member');

	private request_version = 0;
	private mode_observable: Observable<OrchardFederationMode> | null = null;

	/** Retain cdk's warning verbatim without retaining any invitation or private key. */
	public rememberBackupWarning(federation_id: string, warning: string): void {
		this.storage.setItem('v0.federation.backup.id', federation_id);
		this.storage.setItem('v0.federation.backup.warning', warning);
		this.backup_federation_id.set(federation_id);
		this.backup_warning.set(warning);
	}

	/* *******************************************************
        Mode
    ******************************************************** */

	/** Probe the mint daemon's mode. Member and standalone don't change on their own, so they're reused unless refreshed.
	 * A refresh keeps the last known mode until the new one arrives, so pages don't flash an unknown state. */
	public loadMode(refresh = false): Observable<OrchardFederationMode> {
		if (refresh) {
			this.request_version++;
			this.mode_observable = null;
		}
		const version = this.request_version;
		if (!this.configService.config.mint.enabled || this.configService.config.mint.type !== 'cdk') {
			this.mode.set('standalone');
			return of({mode: 'standalone', details: null});
		}
		const mode = this.mode();
		if (!refresh && (mode === 'member' || mode === 'standalone')) return of({mode, details: this.details()});
		if (this.mode_observable) return this.mode_observable;

		this.mode_observable = this.http
			.post<OrchardRes<FederationModeResponse>>(this.apiService.api, getApiQuery(FEDERATION_MODE_QUERY))
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.federation_mode;
				}),
				tap((result) => {
					if (version !== this.request_version) return;
					this.mode.set(result.mode);
					this.details.set(result.details ?? null);
					this.mode_observable = null;
				}),
				shareReplay(1),
				catchError((error) => {
					if (version === this.request_version) this.mode_observable = null;
					return throwError(() => error);
				}),
			);
		return this.mode_observable;
	}
}
