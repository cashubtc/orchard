/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as net from 'net';
/* Vendor Dependencies */
import {SocksClient} from 'socks';
/* Local Dependencies */
import {assertPublicHost} from '../network-guard.js';
import {OrchardPublicPort} from './port.model.js';
import {PublicPortInput} from './port.input.js';

const TCP_TIMEOUT = 10000;

@Injectable()
export class PublicPortService {
	private readonly logger = new Logger(PublicPortService.name);
	private proxy_host: string | null = null;
	private proxy_port: number | null = null;

	constructor(private configService: ConfigService) {
		const server_proxy = this.configService.get('server.proxy');
		if (!server_proxy) return;
		try {
			const url = new URL(server_proxy);
			this.proxy_host = url.hostname;
			this.proxy_port = parseInt(url.port, 10);
		} catch {
			this.logger.warn('Failed to parse proxy URL for TCP testing');
		}
	}

	/** Tests reachability of multiple host:port targets in parallel */
	public async getPortsData(targets: PublicPortInput[]): Promise<OrchardPublicPort[]> {
		const promises = targets.map((target) => this.testPort(target.host, target.port));
		return await Promise.all(promises);
	}

	/** Routes to direct or SOCKS5 based on .onion detection */
	private async testPort(host: string, port: number): Promise<OrchardPublicPort> {
		const is_onion = host.endsWith('.onion');

		/* SSRF guard: resolve DNS and reject private/reserved IPs before connecting */
		try {
			await assertPublicHost(host);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Blocked';
			this.logger.warn(`SSRF blocked for ${host}:${port}: ${message}`);
			return new OrchardPublicPort(host, port, false, message, null);
		}

		try {
			if (is_onion && this.proxy_host && this.proxy_port) {
				return await this.testPortViaSocks(host, port);
			}
			if (is_onion) {
				return new OrchardPublicPort(host, port, false, 'No Tor proxy configured', null);
			}
			return await this.testPortDirect(host, port);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.warn(`TCP test failed for ${host}:${port}: ${message}`);
			return new OrchardPublicPort(host, port, false, message, null);
		}
	}

	/** Direct TCP connect via net.Socket */
	private testPortDirect(host: string, port: number): Promise<OrchardPublicPort> {
		return new Promise((resolve) => {
			const start = Date.now();
			const socket = new net.Socket();
			socket.setTimeout(TCP_TIMEOUT);

			socket.on('connect', () => {
				const latency_ms = Date.now() - start;
				socket.destroy();
				resolve(new OrchardPublicPort(host, port, true, null, latency_ms));
			});

			socket.on('timeout', () => {
				socket.destroy();
				resolve(new OrchardPublicPort(host, port, false, 'Connection timed out', null));
			});

			socket.on('error', (err: Error) => {
				socket.destroy();
				resolve(new OrchardPublicPort(host, port, false, err.message, null));
			});

			socket.connect(port, host);
		});
	}

	/** TCP connect through SOCKS5 proxy for .onion addresses */
	private async testPortViaSocks(host: string, port: number): Promise<OrchardPublicPort> {
		const start = Date.now();
		try {
			const info = await SocksClient.createConnection({
				command: 'connect',
				destination: {host, port},
				proxy: {
					host: this.proxy_host!,
					port: this.proxy_port!,
					type: 5,
				},
				timeout: TCP_TIMEOUT,
			});
			const latency_ms = Date.now() - start;
			info.socket.destroy();
			return new OrchardPublicPort(host, port, true, null, latency_ms);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'SOCKS proxy error';
			return new OrchardPublicPort(host, port, false, message, null);
		}
	}
}
