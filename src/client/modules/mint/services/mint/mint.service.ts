/* Core Dependencies */
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {BehaviorSubject, catchError, map, Observable, of, shareReplay, switchMap, tap, throwError} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {
	MintInfoResponse,
	MintQuoteTtlsResponse,
	MintBalancesResponse,
	MintKeysetsResponse,
	MintMintQuotesResponse,
	MintMeltQuotesResponse,
	MintAnalyticsArgs,
	MintMintQuotesArgs,
	MintMeltQuotesArgs,
	MintSwapsArgs,
	MintKeysetCountsArgs,
	MintAnalyticsBackfillStatusResponse,
	MintAnalyticsKeysetsResponse,
	MintKeysetCountsResponse,
	MintInfoRpcResponse,
	MintNameUpdateResponse,
	MintDescriptionUpdateResponse,
	MintDescriptionLongUpdateResponse,
	MintIconUrlUpdateResponse,
	MintMotdUpdateResponse,
	MintUrlUpdateResponse,
	MintUrlAddResponse,
	MintUrlRemoveResponse,
	MintContactUpdateResponse,
	MintContactRemoveResponse,
	MintContactAddResponse,
	MintQuoteTtlUpdateResponse,
	MintNut04UpdateResponse,
	MintNut05UpdateResponse,
	MintNut04QuoteUpdateResponse,
	MintNut05QuoteUpdateResponse,
	MintKeysetRotationResponse,
	MintMintQuotesDataResponse,
	MintMeltQuotesDataResponse,
	MintSwapsDataResponse,
	MintDatabaseInfoResponse,
	MintDatabaseBackupResponse,
	MintDatabaseRestoreResponse,
	MintProofGroupStatsResponse,
	MintWatchdogStatusResponse,
	MintActivitySummaryResponse,
} from '@client/modules/mint/types/mint.types';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintQuoteTtls} from '@client/modules/mint/classes/mint-quote-ttls.class';
import {MintInfoRpc} from '@client/modules/mint/classes/mint-info-rpc.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintAnalytic, MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
import {AnalyticsBackfillStatus} from '@client/modules/analytics/classes/analytics-backfill-status.class';
import {MintSwap} from '@client/modules/mint/classes/mint-swap.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
import {MintDatabaseInfo} from '@client/modules/mint/classes/mint-database-info.class';
import {MintActivitySummary} from '@client/modules/mint/classes/mint-activity-summary.class';
import {MintWatchdogStatus} from '@client/modules/mint/classes/mint-watchdog-status.class';
/* Shared Dependencies */
import {AnalyticsInterval, MintActivityPeriod, OrchardContact, OrchardMintAnalytics, MintUnit} from '@shared/generated.types';
/* Local Dependencies */
import {
	MINT_INFO_QUERY,
	MINT_INFO_RPC_QUERY,
	MINT_QUOTE_TTLS_QUERY,
	MINT_BALANCES_QUERY,
	MINT_KEYSETS_QUERY,
	MINT_ANALYTICS_BALANCES_QUERY,
	MINT_ANALYTICS_MINTS_QUERY,
	MINT_ANALYTICS_MELTS_QUERY,
	MINT_ANALYTICS_SWAPS_QUERY,
	MINT_ANALYTICS_FEES_QUERY,
	MINT_ANALYTICS_PROOFS_QUERY,
	MINT_ANALYTICS_PROMISES_QUERY,
	MINT_ANALYTICS_BACKFILL_STATUS_QUERY,
	MINT_MINT_QUOTES_QUERY,
	MINT_MELT_QUOTES_QUERY,
	MINT_ANALYTICS_KEYSETS_QUERY,
	MINT_KEYSET_COUNTS_QUERY,
	MINT_MINT_QUOTES_DATA_QUERY,
	MINT_MELT_QUOTES_DATA_QUERY,
	MINT_SWAPS_DATA_QUERY,
	MINT_NAME_MUTATION,
	MINT_DESCRIPTION_MUTATION,
	MINT_DESCRIPTION_LONG_MUTATION,
	MINT_ICON_MUTATION,
	MINT_MOTD_MUTATION,
	MINT_URL_UPDATE_MUTATIONS,
	MINT_URL_ADD_MUTATION,
	MINT_URL_REMOVE_MUTATION,
	MINT_CONTACT_REMOVE_MUTATION,
	MINT_CONTACT_ADD_MUTATION,
	MINT_QUOTE_TTL_MUTATION,
	MINT_NUT04_UPDATE_MUTATION,
	MINT_NUT05_UPDATE_MUTATION,
	MINT_NUT04_QUOTE_UPDATE_MUTATION,
	MINT_NUT05_QUOTE_UPDATE_MUTATION,
	MINT_KEYSETS_ROTATION_MUTATION,
	MINT_DATABASE_INFO_QUERY,
	MINT_DATABASE_BACKUP_MUTATION,
	MINT_DATABASE_RESTORE_MUTATION,
	MINT_PROOF_GROUP_STATS_QUERY,
	MINT_WATCHDOG_STATUS_QUERY,
	MINT_ACTIVITY_SUMMARY_QUERY,
} from './mint.queries';

@Injectable({
	providedIn: 'root',
})
export class MintService {
	public get mint_info$(): Observable<MintInfo | null> {
		return this.mint_info_subject.asObservable();
	}

	public readonly CACHE_KEYS = {
		MINT_INFO: 'mint-info',
		MINT_BALANCES: 'mint-balances',
		MINT_KEYSETS: 'mint-keysets',
		MINT_ANALYTICS_BALANCES: 'mint-analytics-balances',
		MINT_ANALYTICS_PRE_BALANCES: 'mint-analytics-pre-balances',
		MINT_ANALYTICS_MINTS: 'mint-analytics-mints',
		MINT_ANALYTICS_PRE_MINTS: 'mint-analytics-pre-mints',
		MINT_ANALYTICS_MELTS: 'mint-analytics-melts',
		MINT_ANALYTICS_PRE_MELTS: 'mint-analytics-pre-melts',
		MINT_ANALYTICS_SWAPS: 'mint-analytics-swaps',
		MINT_ANALYTICS_PRE_SWAPS: 'mint-analytics-pre-swaps',
		MINT_ANALYTICS_FEES: 'mint-analytics-fees',
		MINT_ANALYTICS_PRE_FEES: 'mint-analytics-pre-fees',
		MINT_ANALYTICS_PROOFS: 'mint-analytics-proofs',
		MINT_ANALYTICS_PRE_PROOFS: 'mint-analytics-pre-proofs',
		MINT_ANALYTICS_PROMISES: 'mint-analytics-promises',
		MINT_ANALYTICS_PRE_PROMISES: 'mint-analytics-pre-promises',
		MINT_ANALYTICS_KEYSETS: 'mint-analytics-keysets',
		MINT_ANALYTICS_PRE_KEYSETS: 'mint-analytics-pre-keysets',
		MINT_KEYSET_COUNTS: 'mint-keyset-counts',
		MINT_MINT_QUOTES: 'mint-mint-quotes',
		MINT_MELT_QUOTES: 'mint-melt-quotes',
		MINT_WATCHDOG_STATUS: 'mint-watchdog-status',
		MINT_DATABASE_INFO: 'mint-database-info',
		MINT_ACTIVITY_SUMMARY: 'mint-activity-summary',
	};

	private readonly CACHE_DURATIONS = {
		[this.CACHE_KEYS.MINT_INFO]: 30 * 60 * 1000, // 30 minutes
		[this.CACHE_KEYS.MINT_BALANCES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_KEYSETS]: 30 * 60 * 1000, // 30 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_BALANCES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_BALANCES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_MINTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_MINTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_MELTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_MELTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_SWAPS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_SWAPS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_FEES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_FEES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PROOFS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROOFS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PROMISES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROMISES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_KEYSETS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_ANALYTICS_PRE_KEYSETS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_KEYSET_COUNTS]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_MINT_QUOTES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_MELT_QUOTES]: 5 * 60 * 1000, // 5 minutes
		[this.CACHE_KEYS.MINT_WATCHDOG_STATUS]: 60 * 60 * 1000, // 60 minutes
		[this.CACHE_KEYS.MINT_DATABASE_INFO]: 60 * 60 * 1000, // 60 minutes
		[this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY]: 5 * 60 * 1000, // 5 minutes
	};

	/* Subjects for caching */
	private readonly mint_info_subject: BehaviorSubject<MintInfo | null>;
	private readonly mint_balances_subject: BehaviorSubject<MintBalance[] | null>;
	private readonly mint_keysets_subject: BehaviorSubject<MintKeyset[] | null>;
	private readonly mint_analytics_balances_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_balances_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_mints_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_mints_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_melts_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_melts_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_swaps_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_swaps_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_fees_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_fees_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_proofs_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_proofs_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_promises_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_pre_promises_subject: BehaviorSubject<MintAnalytic[] | null>;
	private readonly mint_analytics_keysets_subject: BehaviorSubject<MintAnalyticKeyset[] | null>;
	private readonly mint_analytics_pre_keysets_subject: BehaviorSubject<MintAnalyticKeyset[] | null>;
	private readonly mint_keyset_counts_subject: BehaviorSubject<MintKeysetCount[] | null>;
	private readonly mint_mint_quotes_subject: BehaviorSubject<MintMintQuote[] | null>;
	private readonly mint_melt_quotes_subject: BehaviorSubject<MintMeltQuote[] | null>;
	private readonly mint_watchdog_status_subject: BehaviorSubject<MintWatchdogStatus | null>;
	private readonly mint_database_info_subject: BehaviorSubject<MintDatabaseInfo | null>;
	private readonly mint_activity_summary_subject: BehaviorSubject<MintActivitySummary | null>;

	/* Observables for caching (rapid request caching) */
	private mint_info_observable!: Observable<MintInfo> | null;
	private cached_activity_period: MintActivityPeriod | null = null;

	constructor(
		private http: HttpClient,
		private cache: CacheService,
		private apiService: ApiService,
	) {
		this.mint_info_subject = this.cache.createCache<MintInfo>(
			this.CACHE_KEYS.MINT_INFO,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_INFO],
		);
		this.mint_balances_subject = this.cache.createCache<MintBalance[]>(
			this.CACHE_KEYS.MINT_BALANCES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_BALANCES],
		);
		this.mint_keysets_subject = this.cache.createCache<MintKeyset[]>(
			this.CACHE_KEYS.MINT_KEYSETS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_KEYSETS],
		);
		this.mint_analytics_balances_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_BALANCES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_BALANCES],
		);
		this.mint_analytics_pre_balances_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_BALANCES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_BALANCES],
		);
		this.mint_analytics_mints_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_MINTS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_MINTS],
		);
		this.mint_analytics_pre_mints_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_MINTS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_MINTS],
		);
		this.mint_analytics_melts_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_MELTS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_MELTS],
		);
		this.mint_analytics_pre_melts_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_MELTS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_MELTS],
		);
		this.mint_analytics_swaps_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_SWAPS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_SWAPS],
		);
		this.mint_analytics_pre_swaps_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_SWAPS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_SWAPS],
		);
		this.mint_analytics_fees_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_FEES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_FEES],
		);
		this.mint_analytics_pre_fees_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_FEES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_FEES],
		);
		this.mint_analytics_proofs_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PROOFS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PROOFS],
		);
		this.mint_analytics_pre_proofs_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROOFS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROOFS],
		);
		this.mint_analytics_promises_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PROMISES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PROMISES],
		);
		this.mint_analytics_pre_promises_subject = this.cache.createCache<MintAnalytic[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROMISES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROMISES],
		);
		this.mint_analytics_keysets_subject = this.cache.createCache<MintAnalyticKeyset[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_KEYSETS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_KEYSETS],
		);
		this.mint_analytics_pre_keysets_subject = this.cache.createCache<MintAnalyticKeyset[]>(
			this.CACHE_KEYS.MINT_ANALYTICS_PRE_KEYSETS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ANALYTICS_PRE_KEYSETS],
		);
		this.mint_keyset_counts_subject = this.cache.createCache<MintKeysetCount[]>(
			this.CACHE_KEYS.MINT_KEYSET_COUNTS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_KEYSET_COUNTS],
		);
		this.mint_mint_quotes_subject = this.cache.createCache<MintMintQuote[]>(
			this.CACHE_KEYS.MINT_MINT_QUOTES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_MINT_QUOTES],
		);
		this.mint_melt_quotes_subject = this.cache.createCache<MintMeltQuote[]>(
			this.CACHE_KEYS.MINT_MELT_QUOTES,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_MELT_QUOTES],
		);
		this.mint_watchdog_status_subject = this.cache.createCache<MintWatchdogStatus>(
			this.CACHE_KEYS.MINT_WATCHDOG_STATUS,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_WATCHDOG_STATUS],
		);
		this.mint_database_info_subject = this.cache.createCache<MintDatabaseInfo>(
			this.CACHE_KEYS.MINT_DATABASE_INFO,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_DATABASE_INFO],
		);
		this.mint_activity_summary_subject = this.cache.createCache<MintActivitySummary>(
			this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY,
			this.CACHE_DURATIONS[this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY],
		);
	}

	public clearInfoCache() {
		this.cache.clearCache(this.CACHE_KEYS.MINT_INFO);
	}

	public clearDasbhoardCache() {
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_BALANCES);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_BALANCES);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_MINTS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_MINTS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_MELTS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_MELTS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_SWAPS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_SWAPS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_FEES);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_FEES);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PROOFS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROOFS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PROMISES);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROMISES);
	}

	public clearActivityCache() {
		this.cached_activity_period = null;
		this.cache.clearCache(this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY);
	}

	public clearKeysetsCache() {
		this.cache.clearCache(this.CACHE_KEYS.MINT_KEYSETS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_KEYSETS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_ANALYTICS_PRE_KEYSETS);
		this.cache.clearCache(this.CACHE_KEYS.MINT_KEYSET_COUNTS);
	}

	public loadMintInfo(): Observable<MintInfo> {
		if (this.mint_info_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_INFO)) return of(this.mint_info_subject.value);
		if (this.mint_info_observable) return this.mint_info_observable;

		const query = getApiQuery(MINT_INFO_QUERY);

		this.mint_info_observable = this.http.post<OrchardRes<MintInfoResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_info;
			}),
			map((mintInfo) => new MintInfo(mintInfo)),
			tap((mintInfo) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_INFO, mintInfo);
				this.mint_info_subject.next(mintInfo);
				this.mint_info_observable = null;
			}),
			shareReplay(1),
			catchError((error) => {
				console.error('Error loading mint info (public):', error);
				this.mint_info_observable = null;
				return throwError(() => error);
			}),
		);

		return this.mint_info_observable;
	}

	public getMintInfo(): Observable<MintInfoRpc> {
		const query = getApiQuery(MINT_INFO_RPC_QUERY);

		return this.http.post<OrchardRes<MintInfoRpcResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_info_rpc;
			}),
			map((mintInfoRpc) => new MintInfoRpc(mintInfoRpc)),
			catchError((error) => {
				console.error('Error loading mint info (rpc):', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintQuoteTtls(): Observable<MintQuoteTtls> {
		const query = getApiQuery(MINT_QUOTE_TTLS_QUERY);

		return this.http.post<OrchardRes<MintQuoteTtlsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_quote_ttl;
			}),
			map((mintQuoteTtls) => new MintQuoteTtls(mintQuoteTtls)),
			catchError((error) => {
				console.error('Error loading mint quote ttls:', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintKeysetBalance(keyset_id: string): Observable<MintBalance> {
		const query = getApiQuery(MINT_BALANCES_QUERY, {keyset_id});

		return this.http.post<OrchardRes<MintBalancesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_balances;
			}),
			map((mint_balances) => new MintBalance(mint_balances[0])),
			catchError((error) => {
				console.error('Error loading mint keyset balance:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintBalances(): Observable<MintBalance[]> {
		if (this.mint_balances_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_BALANCES)) {
			return of(this.mint_balances_subject.value);
		}

		const query = getApiQuery(MINT_BALANCES_QUERY);

		return this.http.post<OrchardRes<MintBalancesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_balances;
			}),
			map((mint_balances) => mint_balances.map((mint_balance) => new MintBalance(mint_balance))),
			tap((mint_balances) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_BALANCES, mint_balances);
			}),
			catchError((error) => {
				console.error('Error loading mint balances:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintKeysets(): Observable<MintKeyset[]> {
		if (this.mint_keysets_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_KEYSETS)) {
			return of(this.mint_keysets_subject.value);
		}

		const query = getApiQuery(MINT_KEYSETS_QUERY);

		return this.http.post<OrchardRes<MintKeysetsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_keysets;
			}),
			map((mint_keysets) => mint_keysets.map((mint_keyset) => new MintKeyset(mint_keyset))),
			tap((mint_keysets) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_KEYSETS, mint_keysets);
			}),
			catchError((error) => {
				console.error('Error loading mint keysets:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintAnalyticsBalances(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_BALANCES_QUERY,
			response_field: 'mint_analytics_balances',
			subject: this.mint_analytics_balances_subject,
			pre_subject: this.mint_analytics_pre_balances_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_BALANCES,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_BALANCES,
		});
	}

	public loadMintAnalyticsMints(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_MINTS_QUERY,
			response_field: 'mint_analytics_mints',
			subject: this.mint_analytics_mints_subject,
			pre_subject: this.mint_analytics_pre_mints_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_MINTS,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_MINTS,
		});
	}

	public loadMintAnalyticsMelts(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_MELTS_QUERY,
			response_field: 'mint_analytics_melts',
			subject: this.mint_analytics_melts_subject,
			pre_subject: this.mint_analytics_pre_melts_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_MELTS,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_MELTS,
		});
	}

	public loadMintAnalyticsSwaps(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_SWAPS_QUERY,
			response_field: 'mint_analytics_swaps',
			subject: this.mint_analytics_swaps_subject,
			pre_subject: this.mint_analytics_pre_swaps_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_SWAPS,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_SWAPS,
		});
	}

	public loadMintAnalyticsFees(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_FEES_QUERY,
			response_field: 'mint_analytics_fees',
			subject: this.mint_analytics_fees_subject,
			pre_subject: this.mint_analytics_pre_fees_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_FEES,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_FEES,
		});
	}

	public loadMintAnalyticsProofs(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_PROOFS_QUERY,
			response_field: 'mint_analytics_proofs',
			subject: this.mint_analytics_proofs_subject,
			pre_subject: this.mint_analytics_pre_proofs_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PROOFS,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROOFS,
		});
	}

	public loadMintAnalyticsPromises(args: MintAnalyticsArgs): Observable<MintAnalytic[]> {
		return this.loadMintAnalyticsGeneric({
			args,
			query_string: MINT_ANALYTICS_PROMISES_QUERY,
			response_field: 'mint_analytics_promises',
			subject: this.mint_analytics_promises_subject,
			pre_subject: this.mint_analytics_pre_promises_subject,
			cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PROMISES,
			pre_cache_key: this.CACHE_KEYS.MINT_ANALYTICS_PRE_PROMISES,
		});
	}

	/** Generic loader for all mint analytics data types */
	private loadMintAnalyticsGeneric(opts: {
		args: MintAnalyticsArgs;
		query_string: string;
		response_field: string;
		subject: BehaviorSubject<MintAnalytic[] | null>;
		pre_subject: BehaviorSubject<MintAnalytic[] | null>;
		cache_key: string;
		pre_cache_key: string;
	}): Observable<MintAnalytic[]> {
		const {args, query_string, response_field, subject, pre_subject, cache_key, pre_cache_key} = opts;
		const is_pre = args.interval === AnalyticsInterval.Custom;
		const subject_value = is_pre ? pre_subject.value : subject.value;
		const active_cache_key = is_pre ? pre_cache_key : cache_key;

		if (subject_value && this.cache.isCacheValid(active_cache_key)) {
			return of(subject_value);
		}

		const query = getApiQuery(query_string, args);

		return this.http.post<OrchardRes<Record<string, OrchardMintAnalytics[]>>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data[response_field];
			}),
			map((analytics) => analytics.map((item) => new MintAnalytic(item))),
			tap((analytics) => {
				this.cache.updateCache(active_cache_key, analytics);
			}),
			catchError((error) => {
				console.error(`Error loading ${response_field}:`, error);
				return throwError(() => error);
			}),
		);
	}

	public getMintAnalyticsBackfillStatus(): Observable<AnalyticsBackfillStatus> {
		const query = getApiQuery(MINT_ANALYTICS_BACKFILL_STATUS_QUERY);

		return this.http.post<OrchardRes<MintAnalyticsBackfillStatusResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_analytics_backfill_status;
			}),
			map((status) => new AnalyticsBackfillStatus(status)),
			catchError((error) => {
				console.error('Error loading mint analytics backfill status:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintMintQuotes(args?: MintMintQuotesArgs) {
		if (this.mint_mint_quotes_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_MINT_QUOTES)) {
			return of(this.mint_mint_quotes_subject.value);
		}

		const query = getApiQuery(MINT_MINT_QUOTES_QUERY, args);

		return this.http.post<OrchardRes<MintMintQuotesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_mint_quotes;
			}),
			map((mint_mint_quotes) => mint_mint_quotes.map((mint_mint_quote) => new MintMintQuote(mint_mint_quote))),
			tap((mint_mint_quotes) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_MINT_QUOTES, mint_mint_quotes);
			}),
			catchError((error) => {
				console.error('Error loading mint mint quotes:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintMeltQuotes(args?: MintMeltQuotesArgs) {
		if (this.mint_melt_quotes_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_MELT_QUOTES)) {
			return of(this.mint_melt_quotes_subject.value);
		}

		const query = getApiQuery(MINT_MELT_QUOTES_QUERY, args);

		return this.http.post<OrchardRes<MintMeltQuotesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_melt_quotes;
			}),
			map((mint_melt_quotes) => mint_melt_quotes.map((mint_melt_quote) => new MintMeltQuote(mint_melt_quote))),
			tap((mint_melt_quotes) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_MELT_QUOTES, mint_melt_quotes);
			}),
			catchError((error) => {
				console.error('Error loading mint melt quotes:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintAnalyticsKeysets(args: MintAnalyticsArgs) {
		if (args.interval === AnalyticsInterval.Custom) {
			return this.loadGenericMintAnalyticsKeysets(
				args,
				this.mint_analytics_pre_keysets_subject.value,
				this.CACHE_KEYS.MINT_ANALYTICS_PRE_KEYSETS,
			);
		} else {
			return this.loadGenericMintAnalyticsKeysets(
				args,
				this.mint_analytics_keysets_subject.value,
				this.CACHE_KEYS.MINT_ANALYTICS_KEYSETS,
			);
		}
	}

	private loadGenericMintAnalyticsKeysets(
		args: MintAnalyticsArgs,
		subject_value: MintAnalyticKeyset[] | null,
		cache_key: string,
	): Observable<MintAnalyticKeyset[]> {
		if (subject_value && this.cache.isCacheValid(cache_key)) {
			return of(subject_value);
		}

		const query = getApiQuery(MINT_ANALYTICS_KEYSETS_QUERY, args);

		return this.http.post<OrchardRes<MintAnalyticsKeysetsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_analytics_keysets;
			}),
			map((mint_analytics_keysets) => mint_analytics_keysets.map((mint_analytic) => new MintAnalyticKeyset(mint_analytic))),
			tap((mint_analytics_keysets) => {
				this.cache.updateCache(cache_key, mint_analytics_keysets);
			}),
			catchError((error) => {
				console.error('Error loading mint analytics keysets:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintKeysetCounts(args: MintKeysetCountsArgs) {
		if (this.mint_keyset_counts_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_KEYSET_COUNTS)) {
			return of(this.mint_keyset_counts_subject.value);
		}

		const query = getApiQuery(MINT_KEYSET_COUNTS_QUERY, args);

		return this.http.post<OrchardRes<MintKeysetCountsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_keyset_counts;
			}),
			map((mint_keyset_counts) => mint_keyset_counts.map((mint_keyset_count) => new MintKeysetCount(mint_keyset_count))),
			tap((mint_keyset_counts) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_KEYSET_COUNTS, mint_keyset_counts);
			}),
			catchError((error) => {
				console.error('Error loading mint keyset proof counts:', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintMintQuotesData(args: MintMintQuotesArgs) {
		const query = getApiQuery(MINT_MINT_QUOTES_DATA_QUERY, args);

		return this.http.post<OrchardRes<MintMintQuotesDataResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			map((mint_mint_quotes_data) => {
				return {
					mint_mint_quotes: mint_mint_quotes_data.mint_mint_quotes.map((mint_mint_quote) => new MintMintQuote(mint_mint_quote)),
					count: mint_mint_quotes_data.mint_count_mint_quotes.count,
				};
			}),
			catchError((error) => {
				console.error('Error loading mint mint quotes data:', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintMeltQuotesData(args: MintMeltQuotesArgs) {
		const query = getApiQuery(MINT_MELT_QUOTES_DATA_QUERY, args);

		return this.http.post<OrchardRes<MintMeltQuotesDataResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			map((mint_melt_quotes_data) => {
				return {
					mint_melt_quotes: mint_melt_quotes_data.mint_melt_quotes.map((mint_melt_quote) => new MintMeltQuote(mint_melt_quote)),
					count: mint_melt_quotes_data.mint_count_melt_quotes.count,
				};
			}),
			catchError((error) => {
				console.error('Error loading mint melt quotes data:', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintSwapsData(args: MintSwapsArgs) {
		const query = getApiQuery(MINT_SWAPS_DATA_QUERY, args);

		return this.http.post<OrchardRes<MintSwapsDataResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			map((mint_swaps_data) => {
				return {
					mint_swaps: mint_swaps_data.mint_swaps.map((swap) => new MintSwap(swap)),
					count: mint_swaps_data.mint_count_swaps.count,
				};
			}),
			catchError((error) => {
				console.error('Error loading mint swaps data:', error);
				return throwError(() => error);
			}),
		);
	}

	public getMintProofGroupStats(unit: MintUnit) {
		const query = getApiQuery(MINT_PROOF_GROUP_STATS_QUERY, {unit});

		return this.http.post<OrchardRes<MintProofGroupStatsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error loading mint proof group stats:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintWatchdogStatus(): Observable<MintWatchdogStatus> {
		if (this.mint_watchdog_status_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_WATCHDOG_STATUS)) {
			return of(this.mint_watchdog_status_subject.value);
		}

		const query = getApiQuery(MINT_WATCHDOG_STATUS_QUERY);

		return this.http.post<OrchardRes<MintWatchdogStatusResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_watchdog_status;
			}),
			map((status) => new MintWatchdogStatus(status)),
			tap((status) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_WATCHDOG_STATUS, status);
				this.mint_watchdog_status_subject.next(status);
			}),
			catchError((error) => {
				console.error('Error loading mint watchdog status:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintActivitySummary(period: MintActivityPeriod, timezone?: string): Observable<MintActivitySummary> {
		if (period !== this.cached_activity_period) {
			this.clearActivityCache();
		}

		if (this.mint_activity_summary_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY)) {
			return of(this.mint_activity_summary_subject.value);
		}

		const query = getApiQuery(MINT_ACTIVITY_SUMMARY_QUERY, {period, timezone});

		return this.http.post<OrchardRes<MintActivitySummaryResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_activity_summary;
			}),
			map((summary) => new MintActivitySummary(summary)),
			tap((summary) => {
				this.cached_activity_period = period;
				this.cache.updateCache(this.CACHE_KEYS.MINT_ACTIVITY_SUMMARY, summary);
				this.mint_activity_summary_subject.next(summary);
			}),
			catchError((error) => {
				console.error('Error loading mint activity summary:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintName(name: string): Observable<MintNameUpdateResponse> {
		const query = getApiQuery(MINT_NAME_MUTATION, {name});

		return this.http.post<OrchardRes<MintNameUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint name:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintDescription(description: string): Observable<MintDescriptionUpdateResponse> {
		const query = getApiQuery(MINT_DESCRIPTION_MUTATION, {description});

		return this.http.post<OrchardRes<MintDescriptionUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint description:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintDescriptionLong(description: string): Observable<MintDescriptionLongUpdateResponse> {
		const query = getApiQuery(MINT_DESCRIPTION_LONG_MUTATION, {description});

		return this.http.post<OrchardRes<MintDescriptionLongUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint long description:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintIcon(icon_url: string): Observable<MintIconUrlUpdateResponse> {
		const query = getApiQuery(MINT_ICON_MUTATION, {icon_url});

		return this.http.post<OrchardRes<MintIconUrlUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint icon:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintMotd(motd: string): Observable<MintMotdUpdateResponse> {
		const query = getApiQuery(MINT_MOTD_MUTATION, {motd});

		return this.http.post<OrchardRes<MintMotdUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint motd:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintUrl(url_add: string, url_remove: string): Observable<MintUrlUpdateResponse> {
		const query = getApiQuery(MINT_URL_UPDATE_MUTATIONS, {url_add, url_remove});

		return this.http.post<OrchardRes<MintUrlUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint url:', error);
				return throwError(() => error);
			}),
		);
	}

	public addMintUrl(url: string): Observable<MintUrlAddResponse> {
		const query = getApiQuery(MINT_URL_ADD_MUTATION, {url});

		return this.http.post<OrchardRes<MintUrlAddResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error adding mint url:', error);
				return throwError(() => error);
			}),
		);
	}

	public removeMintUrl(url: string): Observable<MintUrlRemoveResponse> {
		const query = getApiQuery(MINT_URL_REMOVE_MUTATION, {url});

		return this.http.post<OrchardRes<MintUrlRemoveResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error removing mint url:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintContact(contact_add: OrchardContact, contact_remove: OrchardContact): Observable<MintContactUpdateResponse> {
		return this.removeMintContact(contact_remove).pipe(
			switchMap((remove_response) => {
				return this.addMintContact(contact_add).pipe(
					map((add_response) => ({
						mint_contact_remove: remove_response.mint_contact_remove,
						mint_contact_add: add_response.mint_contact_add,
					})),
				);
			}),
			catchError((error) => {
				console.error('Error updating mint contact:', error);
				return throwError(() => error);
			}),
		);
	}

	public removeMintContact(contact: OrchardContact): Observable<MintContactRemoveResponse> {
		const query = getApiQuery(MINT_CONTACT_REMOVE_MUTATION, {method: contact.method, info: contact.info});

		return this.http.post<OrchardRes<MintContactRemoveResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error removing mint contact:', error);
				return throwError(() => error);
			}),
		);
	}

	public addMintContact(contact: OrchardContact): Observable<MintContactAddResponse> {
		const query = getApiQuery(MINT_CONTACT_ADD_MUTATION, {method: contact.method, info: contact.info});

		return this.http.post<OrchardRes<MintContactAddResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error adding mint contact:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintQuoteTtl(key: keyof MintQuoteTtls, value: number | null): Observable<MintQuoteTtlUpdateResponse> {
		const query = getApiQuery(MINT_QUOTE_TTL_MUTATION, {mint_quote_ttl_update: {[key]: value}});

		return this.http.post<OrchardRes<MintQuoteTtlUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint quote ttl:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintNut04(unit: string, method: string, key: string, value: any): Observable<MintNut04UpdateResponse> {
		const query = getApiQuery(MINT_NUT04_UPDATE_MUTATION, {unit, method, [key]: value});

		return this.http.post<OrchardRes<MintNut04UpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint nut04:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintNut05(unit: string, method: string, key: string, value: any): Observable<MintNut05UpdateResponse> {
		const query = getApiQuery(MINT_NUT05_UPDATE_MUTATION, {unit, method, [key]: value});

		return this.http.post<OrchardRes<MintNut05UpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint nut05:', error);
				return throwError(() => error);
			}),
		);
	}

	public rotateMintKeysets(
		unit: string,
		input_fee_ppk: number,
		amounts: number[],
		keyset_v2: boolean,
	): Observable<MintKeysetRotationResponse> {
		const query = getApiQuery(MINT_KEYSETS_ROTATION_MUTATION, {unit, input_fee_ppk, amounts, keyset_v2});

		return this.http.post<OrchardRes<MintKeysetRotationResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error rotating mint keysets:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadMintDatabaseInfo(): Observable<MintDatabaseInfo> {
		if (this.mint_database_info_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.MINT_DATABASE_INFO)) {
			return of(this.mint_database_info_subject.value);
		}

		const query = getApiQuery(MINT_DATABASE_INFO_QUERY);

		return this.http.post<OrchardRes<MintDatabaseInfoResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.mint_database_info;
			}),
			map((info) => new MintDatabaseInfo(info)),
			tap((info) => {
				this.cache.updateCache(this.CACHE_KEYS.MINT_DATABASE_INFO, info);
			}),
			catchError((error) => {
				console.error('Error loading mint database info:', error);
				return throwError(() => error);
			}),
		);
	}

	public createMintDatabaseBackup(): Observable<MintDatabaseBackupResponse> {
		const query = getApiQuery(MINT_DATABASE_BACKUP_MUTATION, {});

		return this.http.post<OrchardRes<MintDatabaseBackupResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error creating mint database backup:', error);
				return throwError(() => error);
			}),
		);
	}

	public restoreMintDatabaseBackup(filebase64: string): Observable<MintDatabaseRestoreResponse> {
		const query = getApiQuery(MINT_DATABASE_RESTORE_MUTATION, {filebase64});

		return this.http.post<OrchardRes<MintDatabaseRestoreResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error restoring mint database backup:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMint(mutation: string, variables: Record<string, any>) {
		const query = getApiQuery(mutation, variables);

		return this.http.post<OrchardRes<any>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintNut04Quote(quote_id: string, state: string): Observable<MintNut04QuoteUpdateResponse> {
		const query = getApiQuery(MINT_NUT04_QUOTE_UPDATE_MUTATION, {quote_id, state});

		return this.http.post<OrchardRes<MintNut04QuoteUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint nut04 quote:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateMintNut05Quote(quote_id: string, state: string): Observable<MintNut05QuoteUpdateResponse> {
		const query = getApiQuery(MINT_NUT05_QUOTE_UPDATE_MUTATION, {quote_id, state});

		return this.http.post<OrchardRes<MintNut05QuoteUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data;
			}),
			catchError((error) => {
				console.error('Error updating mint nut05 quote:', error);
				return throwError(() => error);
			}),
		);
	}
}
