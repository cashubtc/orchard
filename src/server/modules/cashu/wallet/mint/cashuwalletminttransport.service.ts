/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {
	HttpResponseError,
	JSONInt,
	MintOperationError,
	NetworkError,
	RateLimitError,
	type RequestFn,
	type RequestOptions,
} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {assertPublicHost} from '#server/modules/fetch/network-guard';
/* Local Dependencies */
import {walletError} from '../cashuwallet.helpers.js';

const MINT_TIMEOUT_MS = 10_000;
const MINT_MAX_BYTES = 256 * 1024;

@Injectable()
export class CashuWalletMintTransportService {
	/** cashu-ts transport for the Orchard mint over MINT_API */
	public readonly request: RequestFn = (options) => this.requestMint(options);
	/** cashu-ts transport for user-added mints: re-checks the address on every request */
	public readonly guarded_request: RequestFn = (options) => this.requestPublicMint(options);

	constructor(
		private configService: ConfigService,
		private fetchService: FetchService,
	) {}

	/* *******************************************************
		Address
	******************************************************** */

	/** Refuse mint URLs that aren't https (onion via Tor excepted) or that reach a private network */
	public async assertPublicMintUrl(mint_url: string): Promise<void> {
		const {protocol, hostname} = new URL(mint_url);
		const host = hostname.replace(/^\[|\]$/g, '');
		if (host.endsWith('.onion')) {
			if (this.configService.get<string>('server.proxy')) return;
			throw walletError('Onion mints need a Tor proxy; set TOR_PROXY_SERVER');
		}
		if (protocol !== 'https:') throw walletError('Mint URLs must use https (http is only allowed for .onion mints)');
		const resolved = await assertPublicHost(host).catch((error) => {
			throw walletError(`${error?.message ?? error}; only public mints can be added`);
		});
		if (!resolved) throw walletError(`Could not resolve mint host ${host}`);
	}

	/* *******************************************************
		Transport
	******************************************************** */

	/** Transport for user-added mints: re-checks the address on every request before sending it */
	private async requestPublicMint<T>(options: RequestOptions): Promise<T> {
		await this.assertPublicMintUrl(options.endpoint).catch((error) => {
			throw new NetworkError(error?.details ?? error?.message ?? String(error), {cause: error});
		});
		return this.requestMint<T>(options);
	}

	/** cashu-ts RequestFn over FetchService (Tor proxy, timeout, size cap, no redirects), keeping its error contract */
	private async requestMint<T>({endpoint, requestBody, headers, method, requestTimeout, signal}: RequestOptions): Promise<T> {
		const timeout_ms = requestTimeout ?? MINT_TIMEOUT_MS;
		const timeout = AbortSignal.timeout(timeout_ms);
		const toNetworkError = (error: any): never => {
			const reason = timeout.aborted ? `timed out after ${timeout_ms}ms` : (error?.code ?? error?.message ?? error);
			throw new NetworkError(`${endpoint}: ${reason}`, {cause: error});
		};
		const response = await this.fetchService
			.fetchWithProxy(endpoint, {
				method: method ?? (requestBody ? 'POST' : 'GET'),
				headers: {Accept: 'application/json', ...(requestBody && {'Content-Type': 'application/json'}), ...headers},
				body: requestBody ? JSONInt.stringify(requestBody) : undefined,
				redirect: 'error',
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
				size: MINT_MAX_BYTES,
			})
			.catch(toNetworkError);
		const text = await response.text().catch(toNetworkError);
		if (response.status === 429)
			throw new RateLimitError('429 Too Many Requests', this.parseRetryAfter(response.headers.get('Retry-After')));
		const body = this.parseBody(text);
		if (response.ok && body) return body as T;
		if (response.status === 400 && typeof body?.code === 'number' && typeof body?.detail === 'string') {
			throw new MintOperationError(body.code, body.detail);
		}
		throw new HttpResponseError(body?.error ?? body?.detail ?? 'HTTP request failed', response.status);
	}

	/** Parse a mint response body with cashu-ts JSONInt, null when it isn't JSON */
	private parseBody(text: string): any {
		try {
			return JSONInt.parse(text);
		} catch {
			return null;
		}
	}

	/** Retry-After header (seconds or HTTP date) in milliseconds */
	private parseRetryAfter(header: string | null): number | undefined {
		if (!header) return undefined;
		const seconds = Number(header);
		if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
		const date = Date.parse(header);
		return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
	}
}
