/* Core Dependencies */
import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/* Vendor Dependencies */
import {map, type Observable} from 'rxjs';

/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import type {OrchardRes} from '@client/modules/api/types/api.types';
import {OrchardErrors} from '@client/modules/error/classes/error.class';

/* Native Dependencies */
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

	/* *******************************************************
        Status
    ******************************************************** */

	/** Read public federation identity, keysets and payment policies. */
	public getInfo(): Observable<OrchardFederationInfo> {
		return this.request(queries.FEDERATION_INFO_QUERY, 'federation_info');
	}

	/** Read local consensus, queues, checkpoints and alerts. */
	public getLocalStatus(): Observable<OrchardFederationLocalStatus> {
		return this.request(queries.FEDERATION_LOCAL_STATUS_QUERY, 'federation_local_status');
	}

	/** Read peer statuses and digest agreement; cdk reuses a snapshot for about five seconds. */
	public getMemberStatuses(): Observable<OrchardFederationMemberStatuses> {
		return this.request(queries.FEDERATION_MEMBER_STATUSES_QUERY, 'federation_member_statuses');
	}

	/** Preserve the absence of each optional custody backend. */
	public getCustodyStatus(): Observable<OrchardFederationCustodyStatus> {
		return this.request(queries.FEDERATION_CUSTODY_STATUS_QUERY, 'federation_custody_status');
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
