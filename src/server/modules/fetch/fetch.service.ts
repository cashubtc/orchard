/* Core Dependencies */
import {Injectable, Logger, type OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import fetch, {Response} from 'node-fetch';
import {SocksProxyAgent} from 'socks-proxy-agent';

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
		const should_use_proxy = this.agent && !this.isLocalAddress(url);
		return should_use_proxy ? fetch(url, {agent: this.agent, ...options}) : fetch(url, options);
	}

	/**
	 * Check if the URL is a local address
	 * Filter out:
	 * - Localhost variants
	 * - Local domain TLDs (mDNS, etc.)
	 * - No TLD (e.g., "myserver")
	 * - Private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
	 * - Link-local addresses (169.254.x.x)
	 * @param {string} url - URL to check
	 * @returns {boolean} True if the URL is a local address, false otherwise
	 */
	private isLocalAddress(url: string): boolean {
		try {
			const parsed = new URL(url);
			const hostname = parsed.hostname.toLowerCase();
			if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
			if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;
			if (!hostname.includes('.')) return true;
			if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
			if (hostname.startsWith('169.254.')) return true;
			if (hostname.startsWith('172.')) {
				const second_octet = parseInt(hostname.split('.')[1]);
				if (second_octet >= 16 && second_octet <= 31) {
					return true;
				}
			}
			return false;
		} catch {
			return false;
		}
	}

	onModuleDestroy() {
		if (this.agent) {
			this.agent.destroy();
			this.logger.log('Proxy agent destroyed');
		}
	}
}
