/* Core Dependencies */
import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {BehaviorSubject, catchError, map, Observable, of, tap, throwError} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {ApiService} from '@client/modules/api/services/api/api.service';
/* Native Dependencies */
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {
	EcashMintsResponse,
	EcashBalancesResponse,
	EcashMintStatusResponse,
	EcashSeedResponse,
	EcashOperationsDataResponse,
	EcashIssueResponse,
	EcashMintAddResponse,
	EcashMintRemoveResponse,
	EcashSeedRevealResponse,
	EcashSeedBackupResponse,
} from '@client/modules/ecash/types/ecash.types';
/* Local Dependencies */
import {
	ECASH_MINTS_QUERY,
	ECASH_BALANCES_QUERY,
	ECASH_MINT_STATUS_QUERY,
	ECASH_SEED_QUERY,
	ECASH_OPERATIONS_DATA_QUERY,
	ECASH_ISSUE_MUTATION,
	ECASH_MINT_ADD_MUTATION,
	ECASH_MINT_REMOVE_MUTATION,
	ECASH_SEED_REVEAL_MUTATION,
	ECASH_SEED_BACKUP_MUTATION,
} from './ecash.queries';
/* Shared Dependencies */
import {QueryEcash_OperationsArgs} from '@shared/generated.types';

@Injectable({
	providedIn: 'root',
})
export class EcashService {
	private readonly http = inject(HttpClient);
	private readonly cache = inject(CacheService);
	private readonly apiService = inject(ApiService);

	private readonly CACHE_KEYS = {
		MINTS: 'ecash-mints',
		BALANCES: 'ecash-balances',
	};
	private readonly CACHE_DURATIONS = {
		[this.CACHE_KEYS.MINTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.BALANCES]: 1 * 60 * 1000, // 1 minute
	};

	/* Subjects for caching */
	private readonly mints_subject: BehaviorSubject<EcashMint[] | null> = this.cache.createCache<EcashMint[]>(
		this.CACHE_KEYS.MINTS,
		this.CACHE_DURATIONS[this.CACHE_KEYS.MINTS],
	);
	private readonly balances_subject: BehaviorSubject<EcashBalance[] | null> = this.cache.createCache<EcashBalance[]>(
		this.CACHE_KEYS.BALANCES,
		this.CACHE_DURATIONS[this.CACHE_KEYS.BALANCES],
	);

	/* *******************************************************
		Cache
	******************************************************** */

	public clearMintsCache(): void {
		this.cache.clearCache(this.CACHE_KEYS.MINTS);
	}

	public clearBalancesCache(): void {
		this.cache.clearCache(this.CACHE_KEYS.BALANCES);
	}

	/* *******************************************************
		Queries
	******************************************************** */

	/** The mints in the current user's wallet */
	public loadMints(): Observable<EcashMint[]> {
		if (this.mints_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINTS)) return of(this.mints_subject.value);
		const query = getApiQuery(ECASH_MINTS_QUERY);
		return this.http.post<OrchardRes<EcashMintsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_mints.map((mint) => new EcashMint(mint));
			}),
			tap((mints) => this.cache.updateCache(this.CACHE_KEYS.MINTS, mints)),
			catchError((error) => throwError(() => error)),
		);
	}

	/** The current user's balances by mint and unit */
	public loadBalances(): Observable<EcashBalance[]> {
		if (this.balances_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.BALANCES)) return of(this.balances_subject.value);
		const query = getApiQuery(ECASH_BALANCES_QUERY);
		return this.http.post<OrchardRes<EcashBalancesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_balances.map((balance) => new EcashBalance(balance));
			}),
			tap((balances) => this.cache.updateCache(this.CACHE_KEYS.BALANCES, balances)),
			catchError((error) => throwError(() => error)),
		);
	}

	/** Whether each wallet mint answers; the server shares each result for a minute, so it isn't cached here */
	public loadMintStatuses(): Observable<EcashMintStatus[]> {
		const query = getApiQuery(ECASH_MINT_STATUS_QUERY);
		return this.http.post<OrchardRes<EcashMintStatusResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_mint_status.map((status) => new EcashMintStatus(status));
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** The seed's backup status, or null before the wallet is first used */
	public loadSeed(): Observable<EcashSeed | null> {
		const query = getApiQuery(ECASH_SEED_QUERY);
		return this.http.post<OrchardRes<EcashSeedResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_seed ? new EcashSeed(response.data.ecash_seed) : null;
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** A page of wallet operations matching the filters, newest first, with the total count for paging */
	public getOperationsData(filters?: QueryEcash_OperationsArgs): Observable<{operations: EcashOperation[]; count: number}> {
		const query = getApiQuery(ECASH_OPERATIONS_DATA_QUERY, filters);
		return this.http.post<OrchardRes<EcashOperationsDataResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return {
					operations: response.data.ecash_operations.map((operation) => new EcashOperation(operation)),
					count: response.data.ecash_operation_count.count,
				};
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/* *******************************************************
		Mutations
	******************************************************** */

	/** Issue ecash on the Orchard mint into the current user's wallet */
	public issueEcash(unit: string, amount: number, memo: string | null = null): Observable<EcashOperation> {
		const query = getApiQuery(ECASH_ISSUE_MUTATION, {unit, amount, memo});
		return this.http.post<OrchardRes<EcashIssueResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new EcashOperation(response.data.ecash_issue);
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** Add a mint to the current user's wallet by URL */
	public addMint(mint_url: string): Observable<EcashMint> {
		const query = getApiQuery(ECASH_MINT_ADD_MUTATION, {mint_url});
		return this.http.post<OrchardRes<EcashMintAddResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new EcashMint(response.data.ecash_mint_add);
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** Remove a mint from the current user's wallet */
	public removeMint(mint_id: string): Observable<boolean> {
		const query = getApiQuery(ECASH_MINT_REMOVE_MUTATION, {mint_id});
		return this.http.post<OrchardRes<EcashMintRemoveResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_mint_remove;
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** Reveal the wallet mnemonic after re-entering the account password */
	public revealSeed(password: string): Observable<string> {
		const query = getApiQuery(ECASH_SEED_REVEAL_MUTATION, {password});
		return this.http.post<OrchardRes<EcashSeedRevealResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.ecash_seed_reveal;
			}),
			catchError((error) => throwError(() => error)),
		);
	}

	/** Confirm the mnemonic has been written down */
	public backupSeed(): Observable<EcashSeed> {
		const query = getApiQuery(ECASH_SEED_BACKUP_MUTATION);
		return this.http.post<OrchardRes<EcashSeedBackupResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new EcashSeed(response.data.ecash_seed_backup);
			}),
			catchError((error) => throwError(() => error)),
		);
	}
}
