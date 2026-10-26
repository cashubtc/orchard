/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {type Client, type ServiceError, type CallOptions, Metadata} from '@grpc/grpc-js';

/* Application Dependencies */
import {closeGrpcChannel} from '#server/modules/grpc/helpers/grpc-client.helpers';
import {isSettingSensitive} from '#server/modules/setting/setting.helpers';
import {CoreService} from '#server/modules/bitcoin/core/core.service';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {bitcoinNetworksMatch} from '#server/modules/bitcoin/helpers/bitcoin-network.helpers';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CredentialService} from '#server/modules/credential/credential.service';
import {LightningType} from '#server/modules/lightning/lightning.enums';
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
import {MintType} from '#server/modules/cashu/cashu.enums';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {CdkService} from '#server/modules/cashu/cdk/cdk.service';
import {NutshellService} from '#server/modules/cashu/nutshell/nutshell.service';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import type {CashuMintDatabase} from '#server/modules/cashu/mintdb/cashumintdb.types';
import {FederationService} from '#server/modules/federation/federation.service';

/* Native Dependencies */
import {ServiceFieldError} from '#server/modules/service-config/classes/service-field-error.class';
import {
	SERVICE_DEFINITIONS,
	SERVICE_FAILURE_TITLES,
	SERVICE_TLS_FAILURE_TITLE,
	CONNECTION_TIMEOUT_MS,
} from '#server/modules/service-config/constants/service-config.constants';
import {
	connectionConfig,
	diagnosticFields,
	redactDiagnostic,
	isTlsDiagnostic,
} from '#server/modules/service-config/helpers/service-config.helpers';
import type {
	ConnectionCheck,
	ConnectionValues,
	IntegrationConfig,
	ServiceFieldName,
	ServiceName,
} from '#server/modules/service-config/types/service-config.types';

@Injectable()
export class ServiceTestService {
	constructor(
		private configService: ConfigService,
		private fetchService: FetchService,
		private credentialService: CredentialService,
		private bitcoinRpcService: BitcoinRpcService,
	) {}

	/* *******************************************************
        Connection tests
    ******************************************************** */

	/** Probe an isolated configuration without modifying the active connections. */
	public async test(service: ServiceName, values: ConnectionValues): Promise<ConnectionCheck> {
		const definition = SERVICE_DEFINITIONS[service];
		const config = new ConfigService({
			[definition.group]: connectionConfig(service, values, this.configService.get<IntegrationConfig>(definition.group)),
		});
		const secrets = definition.fields
			.filter((field) => isSettingSensitive(field.key, values[field.name] ?? ''))
			.map((field) => values[field.name] ?? '');
		const transport = service === 'bitcoin' ? 'HTTP RPC' : service === 'lightning' || values.mtls === 'true' ? 'gRPC over TLS' : 'gRPC';
		const host_key = definition.fields.find((field) => field.name === 'host')?.config ?? 'host';
		const host = String(config.get<IntegrationConfig>(definition.group)?.[host_key] || values.host);
		const result: ConnectionCheck = {
			ok: true,
			warning: false,
			saved: false,
			title: 'Connection successful',
			// The host Orchard dialled, after any Docker localhost rewrite
			context: `${host}:${values.port} · ${transport}`,
			diagnostic: null,
			fields: [],
			chain: null,
			chain_match: null,
			mode: null,
			bitcoin_version: null,
			bitcoin_blocks: null,
			mint_member_id: null,
			mint_member_count: null,
		};
		try {
			this.validate(values, service);
			if (service === 'bitcoin') Object.assign(result, await this.testBitcoin(config));
			if (service === 'lightning') {
				result.chain = await this.testLightning(config, values);
				await this.compareBitcoinChain(result);
			}
			if (service === 'mint') {
				Object.assign(result, await this.testMint(config, values));
				if (values.database) await this.checkMintDatabase(config, result, secrets);
			}
		} catch (error) {
			result.ok = false;
			result.diagnostic = redactDiagnostic(error, secrets);
			const tls_failure =
				isTlsDiagnostic(result.diagnostic) || (error instanceof ServiceFieldError && ['ca', 'cert', 'key'].includes(error.field));
			result.title = tls_failure ? SERVICE_TLS_FAILURE_TITLE : SERVICE_FAILURE_TITLES[service];
			result.fields = error instanceof ServiceFieldError ? [error.field] : diagnosticFields(result.diagnostic, service);
		}
		return result;
	}

	/** Test the optional database read-only, including a real connection for PostgreSQL. */
	public async testDatabase(config: ConfigService): Promise<void> {
		const database_service = new CashuMintDatabaseService(
			config,
			this.credentialService,
			new NutshellService(config, this.credentialService),
			new CdkService(),
		);
		database_service.reinitialize();
		let client: CashuMintDatabase | undefined;
		try {
			client = await database_service.getMintDatabase(true);
			if (client.type === 'postgres') {
				await client.database.connect();
				await client.database.query('SELECT 1');
			} else client.database.prepare('SELECT 1').get();
		} finally {
			if (client?.type === 'postgres') await client.database.end();
			if (client?.type === 'sqlite') client.database.close();
		}
	}

	/** Whether the inputs are well formed, regardless of whether the node answers. */
	public isValid(service: ServiceName, values: ConnectionValues): boolean {
		try {
			this.validate(values, service);
			return true;
		} catch {
			return false;
		}
	}

	/** Reject incomplete transport inputs before attempting to construct a channel. */
	private validate(values: ConnectionValues, service: ServiceName): void {
		if (!values.host) throw new ServiceFieldError('Missing RPC host', 'host');
		if (!/^\d+$/.test(values.port ?? '') || Number(values.port) < 1 || Number(values.port) > 65535)
			throw new ServiceFieldError('Invalid RPC port', 'port');
		const lnd = values.type === LightningType.LND;
		const credentials: ServiceFieldName[] =
			service === 'lightning'
				? lnd
					? ['cert', 'macaroon']
					: ['ca', 'cert', 'key']
				: values.mtls === 'true'
					? ['ca', 'cert', 'key']
					: [];
		for (const field of credentials) {
			const value = values[field];
			if (!value) throw new ServiceFieldError(`Missing credential: ${field}`, field);
			let content: string | undefined;
			try {
				content =
					field === 'macaroon'
						? this.credentialService.loadMacaroonHex(value, true)
						: this.credentialService.loadPemOrPath(value, true)?.toString('utf8');
			} catch (error) {
				throw new ServiceFieldError(error instanceof Error ? error.message : String(error), field);
			}
			// Accept only certificates, keys and macaroons, so a path can't hand some other file to the node
			if (field === 'macaroon' && !content?.startsWith('02')) throw new ServiceFieldError('Not a macaroon', field);
			if (field !== 'macaroon' && !content?.includes('-----BEGIN '))
				throw new ServiceFieldError('Not a PEM certificate or key', field);
		}
	}

	/** Read the actual Bitcoin network through the same HTTP/proxy transport as normal RPCs. */
	private async testBitcoin(
		config: ConfigService,
		include_version = true,
	): Promise<Pick<ConnectionCheck, 'chain' | 'bitcoin_version' | 'bitcoin_blocks'>> {
		const core = new CoreService(config, this.fetchService);
		core.initializeRpc();
		const [info, network] = await Promise.all([
			core.makeRpcRequest('getblockchaininfo', [], CONNECTION_TIMEOUT_MS) as Promise<{chain: string; blocks?: number}>,
			// The version is cosmetic; a node that whitelists RPCs may refuse getnetworkinfo
			include_version
				? (core.makeRpcRequest('getnetworkinfo', [], CONNECTION_TIMEOUT_MS) as Promise<{subversion?: string}>).catch(() => null)
				: Promise.resolve(null),
		]);
		return {
			chain: info.chain,
			bitcoin_blocks: info.blocks ?? null,
			bitcoin_version: network?.subversion?.match(/\/Satoshi:([^/]+)\//)?.[1] ?? network?.subversion ?? null,
		};
	}

	/** Test LND or CLN and always release the temporary channel. */
	private async testLightning(config: ConfigService, values: ConnectionValues): Promise<string> {
		const lnd = values.type === LightningType.LND;
		const client = lnd
			? new LndService(config, this.credentialService).initializeLightningClient()
			: new ClnService(config, this.credentialService).initializeLightningClient();
		try {
			const info = await this.call<{network?: string; chains?: {network: string}[]}>(client, lnd ? 'GetInfo' : 'Getinfo');
			return info.network ?? info.chains?.[0]?.network ?? 'unknown';
		} finally {
			closeGrpcChannel(client);
		}
	}

	/** Warn when the Lightning node and the configured Bitcoin node are on different networks. */
	private async compareBitcoinChain(result: ConnectionCheck): Promise<void> {
		if (!this.bitcoinRpcService.isConfigured() || !result.chain) return;
		try {
			const {chain} = await this.testBitcoin(this.configService, false);
			result.chain_match = bitcoinNetworksMatch(chain, result.chain);
			if (result.chain_match) return;
			result.warning = true;
			result.title = 'Lightning and Bitcoin use different networks';
			result.diagnostic = `Bitcoin: ${chain}; Lightning: ${result.chain}`;
		} catch (error) {
			result.warning = true;
			result.title = 'Lightning connected; Bitcoin network comparison unavailable';
			result.diagnostic = `Bitcoin: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	/** Setup daemons answer their mode probe but do not implement management GetInfo yet. */
	private async testMint(
		config: ConfigService,
		values: ConnectionValues,
	): Promise<Pick<ConnectionCheck, 'mode' | 'mint_member_id' | 'mint_member_count'>> {
		if (values.type === MintType.NUTSHELL) {
			const client = new NutshellService(config, this.credentialService).initializeGrpcClient();
			try {
				await this.call(client, 'GetInfo');
				return {mode: 'standalone', mint_member_id: null, mint_member_count: null};
			} finally {
				closeGrpcChannel(client);
			}
		}
		const rpc = new CdkRpcService(config, this.credentialService);
		try {
			const result = await new FederationService(config, rpc).getMode();
			if (result.mode === 'unreachable') throw new Error(result.details);
			if (result.mode === 'member') {
				const [, info] = await Promise.all([
					rpc.request('GetInfo', {}, CONNECTION_TIMEOUT_MS),
					rpc.request('GetFederationInfo', {}, CONNECTION_TIMEOUT_MS),
				]);
				return {
					mode: result.mode,
					mint_member_id: info.local_member_id ?? null,
					mint_member_count: info.threshold_params?.member_count ?? info.members?.length ?? null,
				};
			}
			if (result.mode !== 'setup') await rpc.request('GetInfo', {}, CONNECTION_TIMEOUT_MS);
			return {mode: result.mode, mint_member_id: null, mint_member_count: null};
		} finally {
			rpc.onModuleDestroy();
		}
	}

	/** A database that won't open only warns, since the mint is managed over RPC. */
	private async checkMintDatabase(config: ConfigService, result: ConnectionCheck, secrets: string[]): Promise<void> {
		try {
			await this.testDatabase(config);
		} catch (error) {
			result.warning = true;
			result.title = 'Mint RPC connected; database could not be opened';
			result.context = 'Orchard connected to the management RPC, then tried to open the mint database.';
			result.diagnostic = redactDiagnostic(error, secrets);
			result.fields = ['database'];
		}
	}

	/** Invoke a generated gRPC method while preserving the upstream diagnostic and deadline. */
	private call<T>(client: Client | undefined, method: string): Promise<T> {
		if (!client) return Promise.reject(new Error('RPC credentials could not be loaded'));
		type Unary = (
			request: object,
			metadata: Metadata,
			options: CallOptions,
			callback: (error: ServiceError | null, response: T) => void,
		) => void;
		const request = (client as unknown as Record<string, Unary>)[method];
		return new Promise((resolve, reject) =>
			request.call(client, {}, new Metadata(), {deadline: Date.now() + CONNECTION_TIMEOUT_MS}, (error, response) =>
				// The message carries the status, e.g. "14 UNAVAILABLE: …", which details alone drops
				error ? reject(new Error(error.message)) : resolve(response),
			),
		);
	}
}
