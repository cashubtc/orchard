/* Core Dependencies */
import {Injectable, Logger, type OnModuleInit, type OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import type {Client} from '@grpc/grpc-js';
/* Application Dependencies */
import {closeGrpcChannel} from '#server/modules/grpc/helpers/grpc-client.helpers';
import {INTEGRATION_REQUEST_TIMEOUT_MS} from '#server/modules/integration/constants/integration.constants';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {LightningType} from '#server/modules/lightning/lightning.enums';
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
/* Local Dependencies */
import type {LightningAddresses} from './lnwalletkit.types.js';

@Injectable()
export class LightningWalletKitService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(LightningWalletKitService.name);

	private grpc_client: any = null;
	private type: LightningType;

	constructor(
		private configService: ConfigService,
		private lndService: LndService,
		private clnService: ClnService,
	) {}

	public async onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.reinitialize();
	}

	/** Build the replacement before releasing the previous channel. */
	public reinitialize(): void {
		const type = this.configService.get<LightningType>('lightning.type');
		let client: Client | null = null;
		try {
			if (type === LightningType.LND) client = this.lndService.initializeWalletKitClient();
			if (type === LightningType.CLN) client = this.clnService.initializeWalletKitClient();
		} catch (error) {
			this.logger.warn(`Lightning wallet credentials could not be loaded: ${(error as Error).message}`);
		}
		const previous = this.grpc_client;
		this.type = type;
		this.grpc_client = client;
		closeGrpcChannel(previous);
	}

	/** Release this service's channel on shutdown. */
	public onModuleDestroy(): void {
		closeGrpcChannel(this.grpc_client);
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.LightningRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.LightningSupportError);
			this.grpc_client[method](request, {deadline: Date.now() + INTEGRATION_REQUEST_TIMEOUT_MS}, (error: Error | null, response: any) => {
				if (error && error?.message?.includes('14 UNAVAILABLE')) reject(OrchardErrorCode.LightningRpcConnectionError);
				if (error) reject(error);
				resolve(response);
			});
		});
	}

	async getLightningAddresses(): Promise<LightningAddresses> {
		if (this.type === 'lnd') return this.makeGrpcRequest('ListAddresses', {});
		if (this.type === 'cln') {
			return this.clnService.mapClnAddresses(
				await this.makeGrpcRequest('ListAddresses', {}),
				await this.makeGrpcRequest('ListFunds', {}),
			);
		}
	}
}
