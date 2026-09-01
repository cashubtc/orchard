/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';

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
		});
		const result = (await response.json()) as {result: any};
		return result.result;
	}
}
