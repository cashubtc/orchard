/* Core Dependencies */
import {Injectable, type OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {readdirSync} from 'node:fs';
import path from 'node:path';

/* Vendor Dependencies */
import {Client, credentials, Metadata, status, type ChannelOptions, type ServiceError} from '@grpc/grpc-js';
import {loadSync, type ServiceDefinition} from '@grpc/proto-loader';

/* Application Dependencies */
import {CredentialService} from '#server/modules/credential/credential.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';

/* Native Dependencies */
import type {CdkRpcMethods} from './cdkrpc.types.js';

/** An Orchard error retaining both the transport status and CDK's exact diagnostic. */
export class CdkRpcError extends Error {
	public readonly code: OrchardErrorCode;
	public readonly grpc_code: number;
	public readonly details: string;

	constructor(grpc_code: number, details: string) {
		super(details);
		this.grpc_code = grpc_code;
		this.details = details;
		const codes: Partial<Record<status, OrchardErrorCode>> = {
			[status.INVALID_ARGUMENT]: OrchardErrorCode.MintRpcInvalidArgumentError,
			[status.FAILED_PRECONDITION]: OrchardErrorCode.MintRpcPreconditionError,
			[status.RESOURCE_EXHAUSTED]: OrchardErrorCode.MintRpcBusyError,
			[status.UNIMPLEMENTED]: OrchardErrorCode.MintSupportError,
			[status.UNAVAILABLE]: OrchardErrorCode.MintRpcConnectionError,
			[status.DEADLINE_EXCEEDED]: OrchardErrorCode.MintRpcConnectionError,
			[status.INTERNAL]: OrchardErrorCode.MintRpcInternalError,
		};
		this.code = codes[grpc_code] ?? OrchardErrorCode.MintRpcActionError;
	}
}

@Injectable()
export class CdkRpcService implements OnModuleDestroy {
	private client: Client | null = null;
	private methods: ServiceDefinition | null = null;

	constructor(
		private configService: ConfigService,
		private credentialService: CredentialService,
	) {}

	/* *******************************************************
        Transport
    ******************************************************** */

	/** Lazily share one channel and one set of credentials across all seven services. */
	private getClient(): Client {
		if (this.client) return this.client;
		const host = this.configService.get<string>('cashu.rpc_host');
		const port = this.configService.get<number>('cashu.rpc_port');
		if (!host || !port)
			throw new CdkRpcError(status.UNAVAILABLE, 'Mint RPC host or port is missing; set MINT_RPC_HOST and MINT_RPC_PORT');
		let channel_credentials = credentials.createInsecure();
		const options: ChannelOptions = {};
		if (this.configService.get<boolean>('cashu.rpc_mtls')) {
			const key = this.credentialService.loadPemOrPath(this.configService.get<string>('cashu.rpc_key'));
			const cert = this.credentialService.loadPemOrPath(this.configService.get<string>('cashu.rpc_cert'));
			const ca = this.credentialService.loadPemOrPath(this.configService.get<string>('cashu.rpc_ca'));
			if (!key || !cert || !ca)
				throw new CdkRpcError(
					status.UNAVAILABLE,
					'Mint RPC TLS credentials are missing; check MINT_RPC_KEY, MINT_RPC_CERT and MINT_RPC_CA',
				);
			channel_credentials = credentials.createSsl(ca, key, cert);
			if (host.includes('host.docker.internal')) {
				options['grpc.ssl_target_name_override'] = 'localhost';
				options['grpc.default_authority'] = 'localhost';
			}
		}
		const proto_dir = path.join(process.cwd(), 'proto/cdk');
		const definitions = loadSync(
			readdirSync(proto_dir)
				.filter((file) => file.endsWith('.proto'))
				.map((file) => path.join(proto_dir, file)),
			{
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		);
		this.methods = {};
		for (const [name, definition] of Object.entries(definitions)) {
			if (name.endsWith('Service')) Object.assign(this.methods, definition);
		}
		this.client = new Client(`${host}:${port}`, channel_credentials, options);
		return this.client;
	}

	/** Drop the channel so the next request connects with the current configuration. */
	public reinitialize(): void {
		const previous = this.client;
		this.client = null;
		this.methods = null;
		previous?.close();
	}

	/** Call the vendored service path with a deadline and no retired protocol header. */
	public request<M extends keyof CdkRpcMethods>(
		method: M,
		request: CdkRpcMethods[M]['request'],
		timeout_ms = 15000,
	): Promise<CdkRpcMethods[M]['response']> {
		return new Promise((resolve, reject) => {
			const client = this.getClient();
			const definition = this.methods[method];
			if (!definition) throw new CdkRpcError(status.UNIMPLEMENTED, `CDK RPC method ${method} is unavailable`);
			client.makeUnaryRequest(
				definition.path,
				definition.requestSerialize,
				definition.responseDeserialize,
				request,
				new Metadata(),
				{deadline: Date.now() + timeout_ms},
				(error: ServiceError | null, response: CdkRpcMethods[M]['response']) => {
					if (error) return reject(new CdkRpcError(error.code, error.details));
					resolve(response);
				},
			);
		});
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Release the shared gRPC channel on application shutdown. */
	public onModuleDestroy(): void {
		this.client?.close();
		this.client = null;
	}
}
