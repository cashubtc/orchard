/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Native Dependencies */
import type {BitcoinRpcOptions} from '#server/modules/bitcoin/rpc/btcrpc.types';

@Injectable()
export class CoreService {
	private rpc_url: string;
	private options: {
		method: string;
		headers: {
			'Content-Type': string;
			Authorization: string;
		};
	};

	constructor(
		private configService: ConfigService,
		private fetchService: FetchService,
	) {}

	public initializeRpc(): void {
		const user = this.configService.get('bitcoin.user');
		const pass = this.configService.get('bitcoin.pass');
		const host = this.configService.get('bitcoin.host');
		const port = this.configService.get('bitcoin.port');
		const clean_host = host.replace(/^https?:\/\//, '');
		this.rpc_url = `http://${clean_host}:${port}/`;
		const auth_string = Buffer.from(`${user}:${pass}`).toString('base64');
		this.options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${auth_string}`,
			},
		};
	}

	/** A JSON-RPC call to the node, failing as its options ask */
	public async makeRpcRequest(method: string, params: any, {strict = false, timeout_ms}: BitcoinRpcOptions = {}): Promise<any> {
		const signal = timeout_ms ? AbortSignal.timeout(timeout_ms) : undefined;
		try {
			const response = await this.fetchService.fetchWithProxy(this.rpc_url, {
				method: this.options.method,
				headers: this.options.headers,
				body: JSON.stringify({jsonrpc: '1.0', id: 'curltext', method, params}),
				signal,
			});
			const result = (await response.json().catch((error) => {
				throw strict && error instanceof SyntaxError ? new Error(`HTTP ${response.status}`) : error;
			})) as {result: any; error: {message: string} | null};
			if (strict && result.error) throw new Error(result.error.message);
			return result.result;
		} catch (error) {
			if (signal?.aborted) throw new Error(`Bitcoin RPC ${method}: timed out after ${timeout_ms}ms`);
			throw strict ? new Error(`Bitcoin RPC ${method}: ${error.code ?? error.message}`) : error;
		}
	}
}
