/* Core Dependencies */
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
/* Vendor Dependencies */
import {BehaviorSubject, catchError, map, Observable, of, shareReplay, tap, throwError, Subject, finalize} from 'rxjs';
import {v4 as uuidv4} from 'uuid';
/* Application Dependencies */
import {getApiQuery, hasGqlWsErrorCode} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
/* Native Dependencies */
import {BitcoinBlockCount} from '@client/modules/bitcoin/classes/bitcoin-blockcount.class';
import {BitcoinBlockchainInfo} from '@client/modules/bitcoin/classes/bitcoin-blockchain-info.class';
import {BitcoinNetworkInfo} from '@client/modules/bitcoin/classes/bitcoin-network-info.class';
import {BitcoinBlock} from '@client/modules/bitcoin/classes/bitcoin-block.class';
import {BitcoinTransaction} from '@client/modules/bitcoin/classes/bitcoin-transaction.class';
import {BitcoinTransactionFeeEstimate} from '@client/modules/bitcoin/classes/bitcoin-transaction-fee-estimate.class';
import {BitcoinBlockTemplate} from '@client/modules/bitcoin/classes/bitcoin-block-template.class';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {BitcoinOracleBackfillProgress} from '@client/modules/bitcoin/classes/bitcoin-oracle-backfill-progress.class';
import {
	BitcoinBlockchainInfoResponse,
	BitcoinBlockCountResponse,
	BitcoinNetworkInfoResponse,
	BitcoinBlockResponse,
	BitcoinMempoolTransactionsResponse,
	BitcoinTransactionFeeEstimatesResponse,
	BitcoinBlockTemplateResponse,
	BitcoinOraclePriceResponse,
	BitcoinOracleBackfillProgressResponse,
	BitcoinOracleBackfillAbortResponse,
} from '@client/modules/bitcoin/types/bitcoin.types';
/* Local Dependencies */
import {
	BITCOIN_BLOCKCHAIN_INFO_QUERY,
	BITCOIN_BLOCK_COUNT_QUERY,
	BITCOIN_NETWORK_INFO_QUERY,
	BITCOIN_BLOCK_QUERY,
	BITCOIN_MEMPOOL_TRANSACTIONS_QUERY,
	BITCOIN_TRANSACTION_FEE_ESTIMATES_QUERY,
	BITCOIN_BLOCK_TEMPLATE_QUERY,
	BITCOIN_ORACLE_PRICE_QUERY,
	BITCOIN_ORACLE_BACKFILL_SUBSCRIPTION,
	BITCOIN_ORACLE_BACKFILL_ABORT_MUTATION,
} from './bitcoin.queries';
/* Shared Dependencies */
import {OrchardBitcoinBlockCount, UtxOracleProgressStatus} from '@shared/generated.types';

@Injectable({
	providedIn: 'root',
})
export class BitcoinService {
	public get bitcoin_blockcount$(): Observable<BitcoinBlockCount | null> {
		return this.bitcoin_block_subject.asObservable();
	}
	public get bitcoin_blockchain_info$(): Observable<BitcoinBlockchainInfo | null> {
		return this.bitcoin_blockchain_info_subject.asObservable();
	}
	public get bitcoin_price$(): Observable<BitcoinOraclePrice | null> {
		return this.bitcoin_oracle_price_subject.asObservable();
	}
	public get backfill_progress$(): Observable<BitcoinOracleBackfillProgress> {
		return this.backfill_progress_subject.asObservable();
	}
	public get backfill_active$(): Observable<boolean> {
		return this.backfill_active_subject.asObservable();
	}

	public readonly CACHE_KEYS = {
		BITCOIN_BLOCKCOUNT: 'bitcoin-blockcount',
		BITCOIN_BLOCKCHAIN_INFO: 'bitcoin-blockchain-info',
		BITCOIN_NETWORK_INFO: 'bitcoin-network-info',
		BITCOIN_ORACLE_PRICE: 'bitcoin-oracle-price',
		BITCOIN_ORACLE_PRICE_MAP: 'bitcoin-oracle-price-map',
	};

	private readonly CACHE_DURATIONS = {
		[this.CACHE_KEYS.BITCOIN_BLOCKCOUNT]: 1 * 60 * 1000, // 1 minute
		[this.CACHE_KEYS.BITCOIN_BLOCKCHAIN_INFO]: 30 * 60 * 1000, // 30 minutes
		[this.CACHE_KEYS.BITCOIN_NETWORK_INFO]: 30 * 60 * 1000, // 30 minutes
		[this.CACHE_KEYS.BITCOIN_ORACLE_PRICE]: 60 * 60 * 1000, // 60 minutes
		[this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP]: 60 * 60 * 1000, // 60 minutes
	};
	private btco_rangekey: string = '';

	/* Subjects for caching */
	private readonly bitcoin_block_subject!: BehaviorSubject<BitcoinBlockCount | null>;
	private readonly bitcoin_blockchain_info_subject: BehaviorSubject<BitcoinBlockchainInfo | null>;
	private readonly bitcoin_network_info_subject: BehaviorSubject<BitcoinNetworkInfo | null>;
	private readonly bitcoin_oracle_price_subject: BehaviorSubject<BitcoinOraclePrice | null>;
	private readonly bitcoin_oracle_price_map_subject: BehaviorSubject<Map<number, number> | null>;

	/* Observables for caching (rapid request caching) */
	private bitcoin_blockchain_info_observable!: Observable<BitcoinBlockchainInfo> | null;
	/* Observables for backfill */
	private backfill_dispose_subscription?: () => void;
	private backfill_subscription_id?: string | null;
	private backfill_progress_subject = new Subject<BitcoinOracleBackfillProgress>();
	private backfill_active_subject = new Subject<boolean>();

	constructor(
		private http: HttpClient,
		private cache: CacheService,
		private apiService: ApiService,
		private authService: AuthService,
		private router: Router,
	) {
		this.bitcoin_block_subject = new BehaviorSubject<BitcoinBlockCount | null>(null);
		this.bitcoin_blockchain_info_subject = this.cache.createCache<BitcoinBlockchainInfo>(
			this.CACHE_KEYS.BITCOIN_BLOCKCHAIN_INFO,
			this.CACHE_DURATIONS[this.CACHE_KEYS.BITCOIN_BLOCKCHAIN_INFO],
		);
		this.bitcoin_network_info_subject = this.cache.createCache<BitcoinNetworkInfo>(
			this.CACHE_KEYS.BITCOIN_NETWORK_INFO,
			this.CACHE_DURATIONS[this.CACHE_KEYS.BITCOIN_NETWORK_INFO],
		);
		this.bitcoin_oracle_price_subject = this.cache.createCache<BitcoinOraclePrice>(
			this.CACHE_KEYS.BITCOIN_ORACLE_PRICE,
			this.CACHE_DURATIONS[this.CACHE_KEYS.BITCOIN_ORACLE_PRICE],
		);
		this.bitcoin_oracle_price_map_subject = this.cache.createCache<Map<number, number>>(
			this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP,
			this.CACHE_DURATIONS[this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP],
		);
	}

	public loadBitcoinBlockchainInfo(): Observable<BitcoinBlockchainInfo> {
		if (this.bitcoin_blockchain_info_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.BITCOIN_BLOCKCHAIN_INFO))
			return of(this.bitcoin_blockchain_info_subject.value);
		if (this.bitcoin_blockchain_info_observable) return this.bitcoin_blockchain_info_observable;

		const query = getApiQuery(BITCOIN_BLOCKCHAIN_INFO_QUERY);

		this.bitcoin_blockchain_info_observable = this.http
			.post<OrchardRes<BitcoinBlockchainInfoResponse>>(this.apiService.api, query)
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.bitcoin_blockchain_info;
				}),
				map((btc_info) => new BitcoinBlockchainInfo(btc_info)),
				tap((btc_info) => {
					this.cache.updateCache(this.CACHE_KEYS.BITCOIN_BLOCKCHAIN_INFO, btc_info);
					this.bitcoin_blockchain_info_subject.next(btc_info);
					this.bitcoin_blockchain_info_observable = null;
				}),
				shareReplay(1),
				catchError((error) => {
					this.bitcoin_blockchain_info_observable = null;
					this.bitcoin_blockchain_info_subject.next(null);
					return throwError(() => error);
				}),
			);
		return this.bitcoin_blockchain_info_observable;
	}

	public loadBitcoinNetworkInfo(): Observable<BitcoinNetworkInfo> {
		if (this.bitcoin_network_info_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.BITCOIN_NETWORK_INFO)) {
			return of(this.bitcoin_network_info_subject.value);
		}

		const query = getApiQuery(BITCOIN_NETWORK_INFO_QUERY);

		return this.http.post<OrchardRes<BitcoinNetworkInfoResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_network_info;
			}),
			map((bitcoin_network_info) => new BitcoinNetworkInfo(bitcoin_network_info)),
			tap((mint_keysets) => {
				this.cache.updateCache(this.CACHE_KEYS.BITCOIN_NETWORK_INFO, mint_keysets);
			}),
			catchError((error) => {
				console.error('Error loading bitcoin network info:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBitcoinBlockchainInfo(): Observable<BitcoinBlockchainInfo> {
		const query = getApiQuery(BITCOIN_BLOCKCHAIN_INFO_QUERY);

		return this.http.post<OrchardRes<BitcoinBlockchainInfoResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_blockchain_info;
			}),
			map((bitcoin_blockchain_info) => new BitcoinBlockchainInfo(bitcoin_blockchain_info)),
			tap((bitcoin_blockchain_info) => {
				this.bitcoin_blockchain_info_subject.next(bitcoin_blockchain_info);
			}),
			catchError((error) => {
				console.error('Error loading bitcoin blockchain info:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBlockCount(): Observable<OrchardBitcoinBlockCount> {
		const query = getApiQuery(BITCOIN_BLOCK_COUNT_QUERY);

		return this.http.post<OrchardRes<BitcoinBlockCountResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_blockcount;
			}),
			map((bitcoin_blockcount) => new BitcoinBlockCount(bitcoin_blockcount)),
			tap((bitcoin_blockcount) => {
				this.bitcoin_block_subject.next(bitcoin_blockcount);
			}),
			catchError((error) => {
				console.error('Error loading bitcoin block count:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBlock(hash: string): Observable<BitcoinBlock> {
		const query = getApiQuery(BITCOIN_BLOCK_QUERY, {hash});

		return this.http.post<OrchardRes<BitcoinBlockResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_block;
			}),
			map((bitcoin_block) => new BitcoinBlock(bitcoin_block)),
			catchError((error) => {
				console.error('Error loading bitcoin block:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBitcoinMempoolTransactions(): Observable<BitcoinTransaction[]> {
		const query = getApiQuery(BITCOIN_MEMPOOL_TRANSACTIONS_QUERY);

		return this.http.post<OrchardRes<BitcoinMempoolTransactionsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_mempool_transactions;
			}),
			map((txs) => txs.map((tx) => new BitcoinTransaction(tx))),
			catchError((error) => {
				console.error('Error loading bitcoin mempool transactions:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBitcoinTransactionFeeEstimates(targets: number[]): Observable<BitcoinTransactionFeeEstimate[]> {
		const query = getApiQuery(BITCOIN_TRANSACTION_FEE_ESTIMATES_QUERY, {targets});

		return this.http.post<OrchardRes<BitcoinTransactionFeeEstimatesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_transaction_fee_estimates;
			}),
			map((fee_estimates) => fee_estimates.map((fee_estimate) => new BitcoinTransactionFeeEstimate(fee_estimate))),
			catchError((error) => {
				console.error('Error loading bitcoin transaction fee estimates:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBitcoinBlockTemplate(): Observable<BitcoinBlockTemplate> {
		const query = getApiQuery(BITCOIN_BLOCK_TEMPLATE_QUERY);

		return this.http.post<OrchardRes<BitcoinBlockTemplateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_block_template;
			}),
			map((block_template) => new BitcoinBlockTemplate(block_template)),
			catchError((error) => {
				console.error('Error loading bitcoin block template:', error);
				return throwError(() => error);
			}),
		);
	}

	public loadBitcoinOraclePrice(): Observable<BitcoinOraclePrice | null> {
		const query = getApiQuery(BITCOIN_ORACLE_PRICE_QUERY);

		return this.http.post<OrchardRes<BitcoinOraclePriceResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_oracle;
			}),
			map((bitcoin_oracle_prices) => (bitcoin_oracle_prices.length > 0 ? new BitcoinOraclePrice(bitcoin_oracle_prices[0]) : null)),
			tap((bitcoin_oracle_price) => {
				this.bitcoin_oracle_price_subject.next(bitcoin_oracle_price);
			}),
			catchError((error) => {
				console.error('Error loading bitcoin oracle price:', error);
				return throwError(() => error);
			}),
		);
	}

	public getBitcoinOraclePriceRange(start_date: number, end_date: number): Observable<BitcoinOraclePrice[]> {
		const query = getApiQuery(BITCOIN_ORACLE_PRICE_QUERY, {start_date, end_date});

		return this.http.post<OrchardRes<BitcoinOraclePriceResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_oracle;
			}),
			map((bitcoin_oracle_prices) =>
				bitcoin_oracle_prices.map((bitcoin_oracle_price) => new BitcoinOraclePrice(bitcoin_oracle_price)),
			),
			catchError((error) => {
				console.error('Error loading bitcoin oracle price range:', error);
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Loads bitcoin oracle prices as a Map keyed by timestamp
	 * Uses range-based caching - invalidates cache if date range changes
	 */
	public loadBitcoinOraclePriceMap(start_date: number, end_date: number): Observable<Map<number, number>> {
		const range_key = `${start_date}-${end_date}`;

		if (
			this.btco_rangekey === range_key &&
			this.bitcoin_oracle_price_map_subject.value &&
			this.cache.isCacheValid(this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP)
		) {
			return of(this.bitcoin_oracle_price_map_subject.value);
		}

		if (this.btco_rangekey !== range_key) {
			this.cache.clearCache(this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP);
			this.btco_rangekey = range_key;
		}

		const query = getApiQuery(BITCOIN_ORACLE_PRICE_QUERY, {start_date, end_date});

		return this.http.post<OrchardRes<BitcoinOraclePriceResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.bitcoin_oracle;
			}),
			map((prices) => new Map(prices.map((p) => [p.date, p.price]))),
			tap((price_map) => {
				this.cache.updateCache(this.CACHE_KEYS.BITCOIN_ORACLE_PRICE_MAP, price_map);
				this.bitcoin_oracle_price_map_subject.next(price_map);
			}),
			catchError((error) => {
				console.error('Error loading bitcoin oracle price map:', error);
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Open a websocket subscription for bitcoin oracle backfill
	 * @param {number} start_date - Unix timestamp for start date
	 * @param {number} end_date - Unix timestamp for end date
	 */
	public openBackfillSocket(start_date: number, end_date?: number | null): void {
		const subscription_id = uuidv4();
		this.backfill_subscription_id = subscription_id;
		this.backfill_active_subject.next(true);

		this.backfill_dispose_subscription = this.apiService.gql_client.subscribe<BitcoinOracleBackfillProgressResponse>(
			getApiQuery(BITCOIN_ORACLE_BACKFILL_SUBSCRIPTION, {id: subscription_id, start_date, end_date}),
			{
				next: (response) => {
					if (!response.data?.bitcoin_oracle_backfill) return;
					const progress = new BitcoinOracleBackfillProgress(response.data.bitcoin_oracle_backfill);
					this.backfill_progress_subject.next(progress);
					if (
						progress.status === UtxOracleProgressStatus.Completed ||
						progress.status === UtxOracleProgressStatus.Error ||
						progress.status === UtxOracleProgressStatus.Aborted
					) {
						this.closeBackfillSocket();
					}
				},
				error: (error) => {
					if (hasGqlWsErrorCode(error, 10002)) {
						this.closeBackfillSocket();
						this.retryBackfillSocket(start_date, end_date);
						return;
					}
					if (hasGqlWsErrorCode(error, 10005)) {
						this.backfill_progress_subject.next(
							new BitcoinOracleBackfillProgress({
								id: subscription_id,
								status: UtxOracleProgressStatus.Error,
								error: 'Throttle limit reached. Please try again later.',
							}),
						);
						this.closeBackfillSocket();
						return;
					}
					console.error('Backfill socket error:', error);
					this.closeBackfillSocket();
				},
				complete: () => this.closeBackfillSocket(),
			},
		);
	}

	public abortBackfillSocket(): void {
		if (!this.backfill_subscription_id) return;
		const query = getApiQuery(BITCOIN_ORACLE_BACKFILL_ABORT_MUTATION, {id: this.backfill_subscription_id});
		this.http
			.post<OrchardRes<BitcoinOracleBackfillAbortResponse>>(this.apiService.api, query)
			.pipe(
				map((response) => {
					if (response.errors) throw new OrchardErrors(response.errors);
					return response.data.bitcoin_oracle_backfill_abort;
				}),
				catchError((error) => {
					console.error('Error aborting bitcoin oracle backfill socket:', error);
					return throwError(() => error);
				}),
				finalize(() => {
					this.closeBackfillSocket();
				}),
			)
			.subscribe();
	}

	private closeBackfillSocket(): void {
		const dispose = this.backfill_dispose_subscription;
		if (!dispose) return;
		this.backfill_dispose_subscription = undefined;
		this.backfill_subscription_id = null;
		this.backfill_active_subject.next(false);
		dispose();
	}

	/**
	 * Retry the backfill socket after refreshing the auth token
	 * @param {number} start_date - Unix timestamp for start date
	 * @param {number} end_date - Unix timestamp for end date
	 */
	private retryBackfillSocket(start_date: number, end_date?: number | null): void {
		this.closeBackfillSocket();
		this.authService
			.refreshToken()
			.pipe(
				tap(() => {
					this.openBackfillSocket(start_date, end_date);
				}),
				catchError((refresh_error) => {
					this.authService.clearAuthCache();
					this.router.navigate(['/auth']);
					return throwError(() => refresh_error);
				}),
			)
			.subscribe();
	}
}
