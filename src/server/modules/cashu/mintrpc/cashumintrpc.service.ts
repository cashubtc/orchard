/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Metadata, ServiceError, status} from '@grpc/grpc-js';
/* Application Dependencies */
import {CdkService} from '@server/modules/cashu/cdk/cdk.service';
import {NutshellService} from '@server/modules/cashu/nutshell/nutshell.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {MintType} from '@server/modules/cashu/cashu.enums';
/* Local Dependencies */
import {CashuMintInfoRpc} from './cashumintrpc.types.js';

@Injectable()
export class CashuMintRpcService implements OnModuleInit {
	private readonly logger = new Logger(CashuMintRpcService.name);
	private grpc_client: any = null;
	private grpc_metadata: Metadata = new Metadata();
	private type: MintType;

	constructor(
		private configService: ConfigService,
		private cdkService: CdkService,
		private nutshellService: NutshellService,
	) {}

	public onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.type = this.configService.get('cashu.type');
		this.initializeGrpcClient();
	}

	private initializeGrpcClient() {
		if (this.type === 'cdk') {
			this.grpc_client = this.cdkService.initializeGrpcClient();
			this.grpc_metadata.set('x-cdk-protocol-version', '1.0.0');
		}
		if (this.type === 'nutshell') this.grpc_client = this.nutshellService.initializeGrpcClient();
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.MintRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.MintSupportError);
			this.grpc_client[method](request, this.grpc_metadata, (error: ServiceError | null, response: any) => {
				if (error) {
					this.logger.debug(`gRPC error: ${error.message}`);

					switch (error.code) {
						case status.INVALID_ARGUMENT:
							reject({code: OrchardErrorCode.MintRpcInvalidArgumentError, details: error.details});
							break;
						case status.UNIMPLEMENTED:
							reject({code: OrchardErrorCode.MintSupportError, details: error.details});
							break;
						case status.INTERNAL:
							reject({code: OrchardErrorCode.MintRpcInternalError, details: error.details});
							break;
						case status.UNAVAILABLE:
							reject({code: OrchardErrorCode.MintRpcConnectionError, details: error.details});
							break;
						default:
							reject(error);
					}
					return;
				}
				resolve(response);
			});
		});
	}

	async getMintInfo(): Promise<CashuMintInfoRpc> {
		const info = await this.makeGrpcRequest('GetInfo', {});
		info.description_long = info.long_description;
		return info;
	}

	async getQuoteTtl(): Promise<{mint_ttl: number; melt_ttl: number}> {
		if (this.type === 'cdk') return this.makeGrpcRequest('GetQuoteTtl', {});
		if (this.type === 'nutshell') return {mint_ttl: null, melt_ttl: null};
	}

	async updateName({name}: {name: string | null}): Promise<{}> {
		return this.makeGrpcRequest('UpdateName', {name});
	}

	async updateMotd({motd}: {motd: string}): Promise<{}> {
		return this.makeGrpcRequest('UpdateMotd', {motd});
	}

	async updateShortDescription({description}: {description: string}): Promise<{}> {
		return this.makeGrpcRequest('UpdateShortDescription', {description});
	}

	async updateLongDescription({description}: {description: string}): Promise<{}> {
		return this.makeGrpcRequest('UpdateLongDescription', {description});
	}

	async updateIconUrl({icon_url}: {icon_url: string}): Promise<{}> {
		return this.makeGrpcRequest('UpdateIconUrl', {icon_url});
	}

	async addUrl({url}: {url: string}): Promise<{}> {
		return this.makeGrpcRequest('AddUrl', {url});
	}

	async removeUrl({url}: {url: string}): Promise<{}> {
		return this.makeGrpcRequest('RemoveUrl', {url});
	}

	async addContact({method, info}: {method: string; info: string}): Promise<{}> {
		return this.makeGrpcRequest('AddContact', {method, info});
	}

	async removeContact({method, info}: {method: string; info: string}): Promise<{}> {
		return this.makeGrpcRequest('RemoveContact', {method, info});
	}

	async updateNut04({
		unit,
		method,
		disabled,
		min_amount,
		max_amount,
		description,
	}: {
		unit: string;
		method: string;
		disabled?: boolean;
		min_amount?: number;
		max_amount?: number;
		description?: boolean;
	}): Promise<{}> {
		const request: any = {unit, method};
		if (disabled !== undefined) request.disabled = disabled;
		if (min_amount !== undefined) request.min_amount = min_amount;
		if (max_amount !== undefined) request.max_amount = max_amount;
		if (description !== undefined) {
			request.options = {description};
		}
		return this.makeGrpcRequest('UpdateNut04', request);
	}

	async updateNut05({
		unit,
		method,
		disabled,
		min_amount,
		max_amount,
		amountless,
	}: {
		unit: string;
		method: string;
		disabled?: boolean;
		min_amount?: number;
		max_amount?: number;
		amountless?: boolean;
	}): Promise<{}> {
		const request: any = {unit, method};
		if (disabled !== undefined) request.disabled = disabled;
		if (min_amount !== undefined) request.min_amount = min_amount;
		if (max_amount !== undefined) request.max_amount = max_amount;
		if (amountless !== undefined) {
			request.options = {amountless};
		}
		return this.makeGrpcRequest('UpdateNut05', request);
	}

	async updateQuoteTtl({mint_ttl, melt_ttl}: {mint_ttl?: number; melt_ttl?: number}): Promise<{}> {
		const request: any = {};
		if (mint_ttl !== undefined) request.mint_ttl = mint_ttl;
		if (melt_ttl !== undefined) request.melt_ttl = melt_ttl;
		return this.makeGrpcRequest('UpdateQuoteTtl', request);
	}

	async updateNut04Quote({quote_id, state}: {quote_id: string; state: string}): Promise<{quote_id: string; state: string}> {
		return this.makeGrpcRequest('UpdateNut04Quote', {quote_id, state});
	}

	async updateNut05Quote({quote_id, state}: {quote_id: string; state: string}): Promise<{quote_id: string; state: string}> {
		if (this.type === 'cdk')
			throw {code: OrchardErrorCode.MintSupportError, details: 'Updating melt quotes is not supported in CDK mints'};
		if (this.type === 'nutshell') return this.makeGrpcRequest('UpdateNut05Quote', {quote_id, state});
	}

	async rotateNextKeyset({
		unit,
		amounts,
		input_fee_ppk,
		keyset_v2,
		final_expiry,
	}: {
		unit: string;
		amounts?: number[];
		input_fee_ppk?: number;
		keyset_v2?: boolean;
		final_expiry?: number | null;
	}): Promise<{id: string; unit: string; amounts: number[]; input_fee_ppk: number}> {
		const request: any = {unit};
		if (amounts !== undefined) request.amounts = amounts;
		if (input_fee_ppk !== undefined) request.input_fee_ppk = input_fee_ppk;
		if (keyset_v2 !== undefined) request.use_keyset_v2 = keyset_v2;
		// Nullish, not undefined-only: an explicit null would encode as proto3 0 (epoch), stamping a bogus expiry.
		if (final_expiry != null) request.final_expiry = final_expiry;
		return this.makeGrpcRequest('RotateNextKeyset', request);
	}
}
