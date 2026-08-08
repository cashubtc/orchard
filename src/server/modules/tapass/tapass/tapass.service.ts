/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {TaprootAssetType} from '#server/modules/tapass/tapass.enums';
import {TapdService} from '#server/modules/tapass/tapd/tapd.service';
/* Local Dependencies */
import type {TaprootAssetsInfo, TaprootAssetsUtxos, TaprootAssets, AssetTransfers, AddrReceives} from './tapass.types.js';

@Injectable()
export class TaprootAssetsService implements OnModuleInit {
	private readonly logger = new Logger(TaprootAssetsService.name);

	private grpc_client: any = null;
	private type: TaprootAssetType;

	constructor(
		private configService: ConfigService,
		private tapdService: TapdService,
	) {}

	public async onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.type = this.configService.get('taproot_assets.type');
		this.initializeGrpcClients();
	}

	private initializeGrpcClients() {
		if (this.type === 'tapd') this.grpc_client = this.tapdService.initializeTaprootAssetsClient();
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.TaprootAssetsRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.TaprootAssetsSupportError);
			this.grpc_client[method](request, (error: Error | null, response: any) => {
				if (error && error?.message?.includes('14 UNAVAILABLE')) reject(OrchardErrorCode.TaprootAssetsRpcConnectionError);
				if (error) reject(error);
				resolve(response);
			});
		});
	}

	async getTaprootAssetsInfo(): Promise<TaprootAssetsInfo> {
		return this.makeGrpcRequest('GetInfo', {});
	}

	async getListTaprootAssets(): Promise<TaprootAssets> {
		return this.makeGrpcRequest('ListAssets', {});
	}

	async getListTaprootAssetsUtxos(): Promise<TaprootAssetsUtxos> {
		return this.makeGrpcRequest('ListUtxos', {});
	}

	/**
	 * Lists outbound asset transfers tracked by tapd
	 * @param anchor_txid - Optional hex-encoded txid to filter by anchor transaction
	 */
	async getListTransfers(anchor_txid?: string): Promise<AssetTransfers> {
		return this.makeGrpcRequest('ListTransfers', {anchor_txid: anchor_txid || ''});
	}

	/**
	 * Lists incoming asset transfer events for previously created addresses
	 * @param filter_addr - Optional TAP address to filter by
	 * @param filter_status - Optional AddrEventStatus (0=all, 1=tx_detected, 2=tx_confirmed, 3=proof_received, 4=completed)
	 */
	async getAddrReceives(filter_addr?: string, filter_status?: number): Promise<AddrReceives> {
		return this.makeGrpcRequest('AddrReceives', {
			filter_addr: filter_addr || '',
			filter_status: filter_status ?? 0,
		});
	}
}
