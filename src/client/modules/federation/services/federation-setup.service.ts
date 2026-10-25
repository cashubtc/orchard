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
import * as queries from '@client/modules/federation/services/federation-setup.queries';

/* Shared Dependencies */
import type {
	FederationSetupCreateInput,
	FederationSetupJoinInput,
	OrchardFederationSetupCreated,
	OrchardFederationSetupInvitationReplaced,
	OrchardFederationSetupAborted,
	OrchardFederationSetupJoined,
	OrchardFederationSetupProposalHash,
	OrchardFederationSetupReview,
	OrchardFederationSetupStatus,
	OrchardFederationSetupActivated,
} from '@shared/generated.types';

@Injectable({providedIn: 'root'})
export class FederationSetupService {
	private readonly http = inject(HttpClient);
	private readonly api_service = inject(ApiService);

	/* *******************************************************
        Setup
    ******************************************************** */

	/** Read current setup progress. */
	public getStatus(): Observable<OrchardFederationSetupStatus> {
		return this.request(queries.FEDERATION_SETUP_STATUS_QUERY, 'federation_setup_status');
	}

	/** Create on this mint and return invitation secrets to the current page only. */
	public create(input: FederationSetupCreateInput): Observable<OrchardFederationSetupCreated> {
		return this.request(queries.FEDERATION_SETUP_CREATE_MUTATION, 'federation_setup_create', {input});
	}

	/** Submit a secret invitation to this mint. */
	public join(input: FederationSetupJoinInput): Observable<OrchardFederationSetupJoined> {
		return this.request(queries.FEDERATION_SETUP_JOIN_MUTATION, 'federation_setup_join', {input});
	}

	/** Publish the coordinator's proposal. */
	public propose(): Observable<OrchardFederationSetupProposalHash> {
		return this.request(queries.FEDERATION_SETUP_PROPOSE_MUTATION, 'federation_setup_propose');
	}

	/** Get the exact proposal operators will approve. */
	public review(): Observable<OrchardFederationSetupReview> {
		return this.request(queries.FEDERATION_SETUP_REVIEW_QUERY, 'federation_setup_review');
	}

	/** Approve only the hash shown during review. */
	public approve(proposal_hash: string): Observable<OrchardFederationSetupProposalHash> {
		return this.request(queries.FEDERATION_SETUP_APPROVE_MUTATION, 'federation_setup_approve', {proposal_hash});
	}

	/** Replace an unjoined slot's invitation, invalidating its previous secret. */
	public replaceInvitation(member_id: number): Observable<OrchardFederationSetupInvitationReplaced> {
		return this.request(queries.FEDERATION_SETUP_REPLACE_INVITATION_MUTATION, 'federation_setup_replace_invitation', {member_id});
	}

	/** Abort this daemon's setup without contacting the other operators. */
	public abort(setup_id: string): Observable<OrchardFederationSetupAborted> {
		return this.request(queries.FEDERATION_SETUP_ABORT_MUTATION, 'federation_setup_abort', {setup_id});
	}

	/** Activate the mint and retain the backup warning in the current page. */
	public activate(): Observable<OrchardFederationSetupActivated> {
		return this.request(queries.FEDERATION_SETUP_ACTIVATE_MUTATION, 'federation_setup_activate');
	}

	/** Keep application diagnostics intact; never cache invitation-bearing responses. */
	private request<T>(query: string, field: string, variables: Record<string, unknown> = {}): Observable<T> {
		return this.http.post<OrchardRes<Record<string, T>>>(this.api_service.api, getApiQuery(query, variables)).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data[field];
			}),
		);
	}
}
