/* Core Dependencies */
import {computed, inject, Injectable, signal, type WritableSignal} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/* Vendor Dependencies */
import {BehaviorSubject, EMPTY, catchError, concat, defer, filter, finalize, map, share, switchMap, take, tap, type Observable} from 'rxjs';
import {DateTime} from 'luxon';

/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import type {OrchardRes} from '@client/modules/api/types/api.types';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import type {OrchardError} from '@client/modules/error/types/error.types';

/* Native Dependencies */
import {isDevelopment} from '@client/modules/federation/helpers/federation-status.helpers';
import {toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';
import * as queries from '@client/modules/federation/services/federation-status.queries';

/* Shared Dependencies */
import type {
	OrchardFederationInfo,
	OrchardFederationLocalStatus,
	OrchardFederationMemberStatuses,
	OrchardFederationCustodyStatus,
} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class FederationStatusService {
	private readonly http = inject(HttpClient);
	private readonly api_service = inject(ApiService);

	public readonly info = signal<OrchardFederationInfo | null>(null);
	public readonly local = signal<OrchardFederationLocalStatus | null>(null);
	public readonly members = signal<OrchardFederationMemberStatuses | null>(null);
	public readonly custody = signal<OrchardFederationCustodyStatus | null>(null);
	public readonly info_error = signal<OrchardError | null>(null);
	public readonly local_error = signal<OrchardError | null>(null);
	public readonly members_error = signal<OrchardError | null>(null);
	public readonly custody_error = signal<OrchardError | null>(null);
	public readonly updated = signal<number | null>(null);

	public readonly development = computed(() => isDevelopment(this.info(), this.custody()));

	private readonly pending = new Map<string, Observable<unknown>>();
	private readonly busy = new BehaviorSubject<boolean>(false);

	/* *******************************************************
        Status
    ******************************************************** */

	/** Read public federation identity, keysets and payment policies; custody from another federation is dropped. */
	public loadInfo(): Observable<OrchardFederationInfo> {
		return this.load<OrchardFederationInfo>(queries.FEDERATION_INFO_QUERY, 'federation_info', this.info_error, (info) => {
			if (this.info()?.federation_id !== info.federation_id) this.custody.set(null);
			this.info.set(info);
		});
	}

	/** Read local consensus, queues, checkpoints and alerts. */
	public loadLocalStatus(): Observable<OrchardFederationLocalStatus> {
		return this.load<OrchardFederationLocalStatus>(
			queries.FEDERATION_LOCAL_STATUS_QUERY,
			'federation_local_status',
			this.local_error,
			(local) => this.local.set(local),
		);
	}

	/** Read peer statuses and digest agreement; cdk reuses a snapshot for about five seconds. */
	public loadMemberStatuses(): Observable<OrchardFederationMemberStatuses> {
		return this.load<OrchardFederationMemberStatuses>(
			queries.FEDERATION_MEMBER_STATUSES_QUERY,
			'federation_member_statuses',
			this.members_error,
			(members) => this.members.set(members),
		);
	}

	/** Preserve the absence of each optional custody backend. */
	public loadCustodyStatus(): Observable<OrchardFederationCustodyStatus> {
		return this.load<OrchardFederationCustodyStatus>(
			queries.FEDERATION_CUSTODY_STATUS_QUERY,
			'federation_custody_status',
			this.custody_error,
			(custody) => this.custody.set(custody),
		);
	}

	/** Read info, then custody, once for the mint header; sources already loaded are skipped. */
	public loadSummary(): Observable<unknown> {
		return concat(...(this.info() ? [] : [this.loadInfo()]), ...(this.custody() ? [] : [this.loadCustodyStatus()]));
	}

	/* *******************************************************
        Requests
    ******************************************************** */

	/** Store each source's value or Orchard error; a read already in flight is shared rather than sent twice. */
	private load<T>(query: string, field: string, error: WritableSignal<OrchardError | null>, store: (value: T) => void): Observable<T> {
		return defer(() => {
			const in_flight = this.pending.get(field) as Observable<T> | undefined;
			if (in_flight) return in_flight;
			const request = this.serialize(this.request<T>(query, field)).pipe(
				tap((value) => {
					store(value);
					error.set(null);
					this.updated.set(DateTime.now().toUnixInteger());
				}),
				catchError((failure: unknown) => {
					error.set(toOrchardError(failure));
					return EMPTY;
				}),
				finalize(() => this.pending.delete(field)),
				share(),
			);
			this.pending.set(field, request);
			return request;
		});
	}

	/** Send one status request at a time across every caller, since cdk refuses requests past its in-flight limit. */
	private serialize<T>(request: Observable<T>): Observable<T> {
		return this.busy.pipe(
			filter(() => !this.busy.value),
			take(1),
			switchMap(() => {
				this.busy.next(true);
				return request.pipe(finalize(() => this.busy.next(false)));
			}),
		);
	}

	/** Keep Orchard error codes and the daemon's diagnostics intact. */
	private request<T>(query: string, field: string): Observable<T> {
		return this.http.post<OrchardRes<Record<string, T>>>(this.api_service.api, getApiQuery(query)).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data[field];
			}),
		);
	}
}
