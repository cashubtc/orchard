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
import {assertPublicDestination} from '#server/modules/fetch/network-guard';
/* Native Dependencies */
import {MintRedirectError} from '#server/modules/cashu/wallet/classes/mint-redirect-error.class';

const MINT_TIMEOUT_MS = 10_000;
const MINT_MAX_BYTES = 256 * 1024;

@Injectable()
export class CashuWalletMintTransportService {
	/** cashu-ts transport for the Orchard mint over MINT_API */
	public readonly request: RequestFn = (options) => this.requestMint(options);

	constructor(
		private configService: ConfigService,
		private fetchService: FetchService,
	) {}

	/* *******************************************************
		Address
	******************************************************** */

	/** Why a mint URL can't be reached: an onion mint without the Tor proxy, or a local address unless local addresses are allowed; null when it can */
	private async refuseMintUrl(mint_url: string, allow_local: boolean): Promise<string | null> {
		const host = new URL(mint_url).hostname.replace(/^\[|\]$/g, '');
		const via_tor = !!this.configService.get<string>('server.proxy');
		if (host.endsWith('.onion')) return via_tor ? null : 'Onion mints need a Tor proxy; set TOR_PROXY_SERVER';
		if (allow_local) return null;
		try {
			return (await assertPublicDestination(mint_url, via_tor)) ? null : `Could not resolve mint host ${host}`;
		} catch (error) {
			return `${error?.message ?? error}; only an admin can add mints on local addresses`;
		}
	}

	/* *******************************************************
		Transport
	******************************************************** */

	/** cashu-ts transport for user-added mints, re-checking the address on every request; local addresses only when allowed */
	public guardedRequest(allow_local: boolean): RequestFn {
		return (options) => this.requestAddedMint(options, allow_local);
	}

	/** Refuses an address that can't be reached before anything is sent, keeping the cashu-ts error contract */
	private async requestAddedMint<T>(options: RequestOptions, allow_local: boolean): Promise<T> {
		const refusal = await this.refuseMintUrl(options.endpoint, allow_local);
		if (refusal) throw new NetworkError(`${options.endpoint}: ${refusal}`);
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
				redirect: 'manual',
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
				size: MINT_MAX_BYTES,
			})
			.catch(toNetworkError);
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			throw new MintRedirectError(endpoint, location ? new URL(location, endpoint).href : null);
		}
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
