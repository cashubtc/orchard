/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {INTEGRATION_REQUEST_TIMEOUT_MS} from '#server/modules/integration/constants/integration.constants';

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
		if (!host || !port) throw new Error('Bitcoin RPC host or port is missing');
		const url = new URL(/^https?:\/\//.test(host) ? host : `http://${host}`);
		url.port = String(port);
		this.rpc_url = url.toString();
		const auth_string = Buffer.from(`${user}:${pass}`).toString('base64');
		this.options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${auth_string}`,
			},
		};
	}

	public async makeRpcRequest(method: string, params: any): Promise<any> {
		const data_string = JSON.stringify({
			jsonrpc: '1.0',
			id: 'curltext',
			method: method,
			params: params,
		});
		const response = await this.fetchService.fetchWithProxy(this.rpc_url, {
			method: this.options.method,
			headers: this.options.headers,
			body: data_string,
			signal: AbortSignal.timeout(INTEGRATION_REQUEST_TIMEOUT_MS),
		});
		const body = await response.text();
		let result: {result: unknown; error?: {message: string} | null} | null = null;
		try {
			result = JSON.parse(body);
		} catch {
			// Bitcoin Core answers authentication and transport failures without a JSON body
		}
		if (result?.error) throw new Error(result.error.message);
		if (!response.ok || !result) throw new Error(body || `${response.status} ${response.statusText}`);
		return result.result;
	}
}
