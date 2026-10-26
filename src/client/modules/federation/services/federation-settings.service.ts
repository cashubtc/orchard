/* Core Dependencies */
import {Injectable, computed, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {finalize, map, type Observable} from 'rxjs';

/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import type {OrchardRes} from '@client/modules/api/types/api.types';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {FEDERATION_SETTINGS_COMPARISON_QUERY} from '@client/modules/federation/services/federation-settings.queries';
import {FEDERATION_SETTINGS_REUSE_SECONDS} from '@client/modules/federation/constants/federation-settings.constants';
import {federationSettingsHints} from '@client/modules/federation/helpers/federation-settings.helpers';
import {toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';

/* Shared Dependencies */
import type {OrchardFederationSettingsComparison} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class FederationSettingsService {
	private readonly http = inject(HttpClient);
	private readonly api_service = inject(ApiService);

	public readonly comparison = signal<OrchardFederationSettingsComparison | null>(null);
	public readonly loading = signal<boolean>(false);
	public readonly error = signal<OrchardError | null>(null);
	public readonly hints = computed(() => federationSettingsHints(this.comparison()));

	/* *******************************************************
        Comparison
    ******************************************************** */

	/** Read the server's comparison snapshot, optionally bypassing its short cache. */
	public getComparison(refresh = false): Observable<OrchardFederationSettingsComparison> {
		return this.http
			.post<OrchardRes<{federation_settings_comparison: OrchardFederationSettingsComparison}>>(
				this.api_service.api,
				getApiQuery(FEDERATION_SETTINGS_COMPARISON_QUERY, {refresh}),
			)
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.federation_settings_comparison;
				}),
			);
	}

	/** Load on page entry, reusing a comparison from the last minute, or read again on an explicit refresh. */
	public load(refresh = false): void {
		const checked_at = this.comparison()?.checked_at;
		const recent = checked_at !== undefined && DateTime.now().toUnixInteger() - checked_at < FEDERATION_SETTINGS_REUSE_SECONDS;
		if (this.loading() || (!refresh && recent)) return;
		this.loading.set(true);
		this.error.set(null);
		this.getComparison(refresh)
			.pipe(finalize(() => this.loading.set(false)))
			.subscribe({
				next: (comparison) => this.comparison.set(comparison),
				error: (error: unknown) => {
					this.comparison.set(null);
					this.error.set(toOrchardError(error));
				},
			});
	}
}
