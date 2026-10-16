/* Core Dependencies */
import {Injectable, Logger, type OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import fetch, {Response} from 'node-fetch';
import {SocksProxyAgent} from 'socks-proxy-agent';
/* Local Dependencies */
import {isLocalAddress} from './network-guard.js';

@Injectable()
export class FetchService implements OnModuleDestroy {
	private readonly logger = new Logger(FetchService.name);

	private agent: SocksProxyAgent | null = null;

	constructor(private configService: ConfigService) {
		const server_proxy = this.configService.get('server.proxy');
		if (!server_proxy) return;
		this.logger.log(`Using tor proxy for external requests: ${server_proxy}`);
		this.agent = new SocksProxyAgent(server_proxy);
	}

	/**
	 * Fetch with optional Tor proxy support
	 * Bypasses proxy for local/private addresses
	 * @param {string} url - URL to fetch
	 * @param {any} options - Fetch options (method, headers, body, etc.)
	 * @returns {Promise<Response>} Fetch Response object
	 */
	async fetchWithProxy(url: string, options?: any): Promise<Response> {
		const should_use_proxy = this.agent && !isLocalAddress(url);
		return should_use_proxy ? fetch(url, {agent: this.agent, ...options}) : fetch(url, options);
	}

	onModuleDestroy() {
		if (this.agent) {
			this.agent.destroy();
			this.logger.log('Proxy agent destroyed');
		}
	}
}
