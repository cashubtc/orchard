/* Core Dependencies */
import {Injectable, Logger, type OnModuleInit, type OnModuleDestroy} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Metadata, type Client, type ServiceError, status} from '@grpc/grpc-js';
/* Application Dependencies */
import {closeGrpcChannel} from '#server/modules/grpc/helpers/grpc-client.helpers';
import {INTEGRATION_REQUEST_TIMEOUT_MS} from '#server/modules/integration/constants/integration.constants';
import {CdkRpcError} from '#server/modules/cashu/cdk/classes/cdk-rpc-error.class';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import type {CdkRpcMethods} from '#server/modules/cashu/cdk/cdkrpc.types';
import {FederationService} from '#server/modules/federation/federation.service';
import {NutshellService} from '#server/modules/cashu/nutshell/nutshell.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {MintType} from '#server/modules/cashu/cashu.enums';
/* Local Dependencies */
import type {CashuMintInfoRpc} from './cashumintrpc.types.js';

@Injectable()
export class CashuMintRpcService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(CashuMintRpcService.name);
	private grpc_client: any = null;
	private grpc_metadata: Metadata = new Metadata();
	private type: MintType;

	constructor(
		private configService: ConfigService,
		private cdkRpcService: CdkRpcService,
		private nutshellService: NutshellService,
		private federationService: FederationService,
	) {}

	public onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.reinitialize();
	}

	/** Replace the selected mint implementation and release its old transport. */
	public reinitialize(): void {
		const type = this.configService.get<MintType>('cashu.type');
		let client: Client | null = null;
		try {
			if (type === MintType.NUTSHELL) client = this.nutshellService.initializeGrpcClient();
		} catch (error) {
			this.logger.warn(`Mint RPC credentials could not be loaded: ${(error as Error).message}`);
		}
		const previous = this.grpc_client;
		this.grpc_client = client;
		this.type = type;
		closeGrpcChannel(previous);
	}

	/** Release the Nutshell transport on shutdown. */
	public onModuleDestroy(): void {
		closeGrpcChannel(this.grpc_client);
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.MintRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.MintSupportError);
			this.grpc_client[method](
				request,
				this.grpc_metadata,
				{deadline: Date.now() + INTEGRATION_REQUEST_TIMEOUT_MS},
				(error: ServiceError | null, response: any) => {
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
				},
			);
		});
	}

	/** CDK's split services keep the legacy method names and request shapes for these calls. */
	private callRpc<M extends keyof CdkRpcMethods>(method: M, request: CdkRpcMethods[M]['request']): Promise<CdkRpcMethods[M]['response']> {
		if (this.type === MintType.CDK) return this.cdkRpcService.request(method, request);
		return this.makeGrpcRequest(method, request);
	}

	/** CDK splits method limits and the mint-wide disabled flag into separate calls. */
	private async updateCdkMethod<M extends 'UpdateMintMethod' | 'UpdateMeltMethod'>(
		method: M,
		{disabled, ...request}: CdkRpcMethods[M]['request'] & {disabled?: boolean},
	): Promise<object> {
		const update_method = disabled === undefined || Object.keys(request).some((key) => key !== 'unit' && key !== 'method');
		if (update_method) await this.cdkRpcService.request(method, request as CdkRpcMethods[M]['request']);
		if (disabled === undefined) return {};
		const flag = method === 'UpdateMintMethod' ? {mint_disabled: disabled} : {melt_disabled: disabled};
		try {
			return await this.cdkRpcService.request('UpdateDisabled', flag);
		} catch (error) {
			if (!update_method) throw error;
			const diagnostic = error instanceof CdkRpcError ? error.details : error instanceof Error ? error.message : String(error);
			const operation = method === 'UpdateMintMethod' ? 'minting' : 'melting';
			throw new CdkRpcError(
				error instanceof CdkRpcError ? error.grpc_code : status.UNKNOWN,
				`Payment method settings saved; mint-wide ${operation} disabled flag update failed: ${diagnostic}`,
			);
		}
	}

	/** Adapt the typed RPC metadata for the mint info API. */
	async getMintInfo(): Promise<CashuMintInfoRpc> {
		const info = await this.callRpc('GetInfo', {});
		return {...info, description_long: info.long_description};
	}

	async getQuoteTtl(): Promise<{mint_ttl: number; melt_ttl: number}> {
		if (this.type === MintType.CDK) {
			const {mint_ttl, melt_ttl} = await this.cdkRpcService.request('GetQuoteTtl', {});
			return {mint_ttl: Number(mint_ttl), melt_ttl: Number(melt_ttl)};
		}
		if (this.type === MintType.NUTSHELL) return {mint_ttl: null, melt_ttl: null};
	}

	async updateName({name}: {name: string | null}): Promise<{}> {
		if (this.type === MintType.CDK) return this.cdkRpcService.request('UpdateName', {name: name ?? ''});
		return this.makeGrpcRequest('UpdateName', {name});
	}

	async updateMotd({motd}: {motd: string}): Promise<{}> {
		return this.callRpc('UpdateMotd', {motd});
	}

	async updateShortDescription({description}: {description: string}): Promise<{}> {
		return this.callRpc('UpdateShortDescription', {description});
	}

	async updateLongDescription({description}: {description: string}): Promise<{}> {
		if (this.type === MintType.CDK) return this.cdkRpcService.request('UpdateLongDescription', {long_description: description});
		return this.makeGrpcRequest('UpdateLongDescription', {description});
	}

	async updateIconUrl({icon_url}: {icon_url: string}): Promise<{}> {
		return this.callRpc('UpdateIconUrl', {icon_url});
	}

	async addUrl({url}: {url: string}): Promise<{}> {
		return this.callRpc('AddUrl', {url});
	}

	async removeUrl({url}: {url: string}): Promise<{}> {
		return this.callRpc('RemoveUrl', {url});
	}

	async addContact({method, info}: {method: string; info: string}): Promise<{}> {
		return this.callRpc('AddContact', {method, info});
	}

	async removeContact({method, info}: {method: string; info: string}): Promise<{}> {
		return this.callRpc('RemoveContact', {method, info});
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
		const request: CdkRpcMethods['UpdateMintMethod']['request'] & {disabled?: boolean} = {unit, method};
		if (disabled !== undefined) request.disabled = disabled;
		if (min_amount !== undefined) request.min_amount = min_amount;
		if (max_amount !== undefined) request.max_amount = max_amount;
		if (description !== undefined) {
			request.options = {description};
		}
		if (this.type === MintType.CDK) return this.updateCdkMethod('UpdateMintMethod', request);
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
		const request: CdkRpcMethods['UpdateMeltMethod']['request'] & {disabled?: boolean} = {unit, method};
		if (disabled !== undefined) request.disabled = disabled;
		if (min_amount !== undefined) request.min_amount = min_amount;
		if (max_amount !== undefined) request.max_amount = max_amount;
		if (amountless !== undefined) {
			request.options = {amountless};
		}
		if (this.type === MintType.CDK) return this.updateCdkMethod('UpdateMeltMethod', request);
		return this.makeGrpcRequest('UpdateNut05', request);
	}

	async updateQuoteTtl({mint_ttl, melt_ttl}: {mint_ttl?: number; melt_ttl?: number}): Promise<{}> {
		const request: CdkRpcMethods['UpdateQuoteTtl']['request'] = {};
		if (mint_ttl !== undefined) request.mint_ttl = mint_ttl;
		if (melt_ttl !== undefined) request.melt_ttl = melt_ttl;
		return this.callRpc('UpdateQuoteTtl', request);
	}

	async updateNut04Quote({quote_id, state}: {quote_id: string; state: string}): Promise<{quote_id: string; state: string}> {
		if (this.type === MintType.CDK) {
			await this.federationService.assertStandaloneOperation();
			const response = await this.cdkRpcService.request('UpdateMintQuoteState', {
				quote_id,
				state: `MINT_QUOTE_STATE_${state}` as 'MINT_QUOTE_STATE_UNPAID' | 'MINT_QUOTE_STATE_PAID' | 'MINT_QUOTE_STATE_ISSUED',
			});
			return {quote_id: response.quote_id, state: response.state.replace('MINT_QUOTE_STATE_', '')};
		}
		return this.makeGrpcRequest('UpdateNut04Quote', {quote_id, state});
	}

	async updateNut05Quote({quote_id, state}: {quote_id: string; state: string}): Promise<{quote_id: string; state: string}> {
		if (this.type === MintType.CDK)
			throw {code: OrchardErrorCode.MintSupportError, details: 'Updating melt quotes is not supported in CDK mints'};
		if (this.type === MintType.NUTSHELL) return this.makeGrpcRequest('UpdateNut05Quote', {quote_id, state});
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
		const request: CdkRpcMethods['RotateNextKeyset']['request'] = {unit};
		if (amounts !== undefined) request.amounts = amounts;
		if (input_fee_ppk !== undefined) request.input_fee_ppk = input_fee_ppk;
		if (keyset_v2 !== undefined) request.use_keyset_v2 = keyset_v2;
		// Nullish, not undefined-only: an explicit null would encode as proto3 0 (epoch), stamping a bogus expiry.
		if (final_expiry != null) request.final_expiry = final_expiry;
		if (this.type === MintType.CDK) {
			await this.federationService.assertStandaloneOperation();
			const response = await this.cdkRpcService.request('RotateNextKeyset', request);
			return {...response, amounts: response.amounts.map(Number), input_fee_ppk: Number(response.input_fee_ppk)};
		}
		return this.makeGrpcRequest('RotateNextKeyset', request);
	}
}
