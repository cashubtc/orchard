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
import {INTEGRATION_REQUEST_TIMEOUT_MS} from '#server/modules/integration/constants/integration.constants';

/* Native Dependencies */
import type {CdkRpcMethods} from './cdkrpc.types.js';

/** An Orchard error retaining both the transport status and CDK's exact diagnostic. */
export class CdkRpcError extends Error {
	public readonly code: OrchardErrorCode;
	public readonly grpc_code: number;
	public readonly details: string;

	constructor(grpc_code: number, details: string) {
		// An unknown service answers with an empty message; the status name is the only diagnostic left
		const diagnostic = details || status[grpc_code] || `gRPC status ${grpc_code}`;
		super(diagnostic);
		this.grpc_code = grpc_code;
		this.details = diagnostic;
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
		try {
			return this.createClient();
		} catch (error) {
			// Credential, proto and target failures carry no gRPC status; keep their message for the operator
			if (error instanceof CdkRpcError) throw error;
			throw new CdkRpcError(status.UNAVAILABLE, error instanceof Error ? error.message : String(error));
		}
	}

	/** Build the channel from the current configuration. */
	private createClient(): Client {
		const host = this.configService.get<string>('cashu.rpc_host');
		const port = this.configService.get<number>('cashu.rpc_port');
		if (!host || !port) throw new CdkRpcError(status.UNAVAILABLE, 'Mint RPC host and port are not configured');
		let channel_credentials = credentials.createInsecure();
		const options: ChannelOptions = {};
		if (this.configService.get<boolean>('cashu.rpc_mtls')) {
			const [key, cert, ca] = (['key', 'cert', 'ca'] as const).map((field) => this.loadCredential(field));
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

	/** Read one mTLS credential, naming it when it is missing or unreadable. */
	private loadCredential(field: 'key' | 'cert' | 'ca'): Buffer {
		const label = {key: 'client key', cert: 'client certificate', ca: 'CA certificate'}[field];
		let credential: Buffer | undefined;
		try {
			credential = this.credentialService.loadPemOrPath(this.configService.get<string>(`cashu.rpc_${field}`), true);
		} catch (error) {
			throw new CdkRpcError(status.UNAVAILABLE, `Mint RPC ${label}: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!credential) throw new CdkRpcError(status.UNAVAILABLE, `Mint RPC ${label} is not configured`);
		return credential;
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
		timeout_ms = INTEGRATION_REQUEST_TIMEOUT_MS,
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
