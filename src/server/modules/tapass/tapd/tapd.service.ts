/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
/* Vendor Dependencies */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
/* Application Dependencies */
import {CredentialService} from '#server/modules/credential/credential.service';

@Injectable()
export class TapdService {
	private readonly logger = new Logger(TapdService.name);

	constructor(
		private configService: ConfigService,
		private credentialService: CredentialService,
	) {}

	private createGrpcCredentials() {
		const rpc_host = this.configService.get('taproot_assets.host');
		const rpc_port = this.configService.get('taproot_assets.port');
		const rpc_macaroon = this.configService.get('taproot_assets.macaroon');
		const rpc_tls_cert = this.configService.get('taproot_assets.cert');

		if (!rpc_host || !rpc_port || !rpc_macaroon || !rpc_tls_cert) {
			this.logger.warn('Missing TAPD RPC credentials, secure connection cannot be established');
			return null;
		}

		const rpc_url = `${rpc_host}:${rpc_port}`;
		const macaroon_hex = this.credentialService.loadMacaroonHex(rpc_macaroon);
		const cert_content = this.credentialService.loadPemOrPath(rpc_tls_cert);

		if (!macaroon_hex) {
			this.logger.error('Failed to load TAPD macaroon — check that the file path exists and is readable');
			return null;
		}
		if (!cert_content) {
			this.logger.error('Failed to load TAPD TLS certificate — check that the file path exists and is readable');
			return null;
		}

		const metadata = new grpc.Metadata();
		metadata.add('macaroon', macaroon_hex);
		const macaroon_creds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
			callback(null, metadata);
		});
		const ssl_creds = grpc.credentials.createSsl(cert_content);
		const combined_creds = grpc.credentials.combineChannelCredentials(ssl_creds, macaroon_creds);

		// When running in Docker, we connect to host.docker.internal but need to verify against localhost
		let channel_options: Record<string, any> | undefined = undefined;
		if (rpc_host?.includes('host.docker.internal')) {
			channel_options = {
				'grpc.ssl_target_name_override': 'localhost',
				'grpc.default_authority': 'localhost',
			};
		}

		return {rpc_url, combined_creds, channel_options};
	}

	private initializeGrpcClient(proto_paths: string[], package_namespace: string, client_class: string): grpc.Client {
		const credentials = this.createGrpcCredentials();
		if (!credentials) {
			return;
		}

		try {
			const package_definition = protoLoader.loadSync(proto_paths, {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			});
			const grpc_package: any = grpc.loadPackageDefinition(package_definition)[package_namespace];
			this.logger.log(`${client_class} gRPC client initialized with TLS certificate authentication`);
			return new grpc_package[client_class](credentials.rpc_url, credentials.combined_creds, credentials.channel_options);
		} catch (error) {
			this.logger.error(`Failed to initialize ${client_class} gRPC client: ${error.message}`);
			throw error;
		}
	}

	public initializeTaprootAssetsClient(): grpc.Client {
		const taproot_assets_proto_path = path.join(process.cwd(), 'proto/tapd/taprootassets.proto');
		return this.initializeGrpcClient([taproot_assets_proto_path], 'taprpc', 'TaprootAssets');
	}
}
