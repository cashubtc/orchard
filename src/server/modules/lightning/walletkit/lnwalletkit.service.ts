/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {LightningType} from '#server/modules/lightning/lightning.enums';
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
/* Local Dependencies */
import {LightningAddresses} from './lnwalletkit.types.js';

@Injectable()
export class LightningWalletKitService implements OnModuleInit {
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
		this.type = this.configService.get('lightning.type');
		this.initializeGrpcClients();
	}

	private initializeGrpcClients() {
		if (this.type === 'lnd') this.grpc_client = this.lndService.initializeWalletKitClient();
		if (this.type === 'cln') this.grpc_client = this.clnService.initializeWalletKitClient();
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.LightningRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.LightningSupportError);
			this.grpc_client[method](request, (error: Error | null, response: any) => {
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
