/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import type {CdkRpcMethods} from '#server/modules/cashu/cdk/cdkrpc.types';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {CdkRpcError} from '#server/modules/cashu/cdk/classes/cdk-rpc-error.class';
import {MintType} from '#server/modules/cashu/cashu.enums';

/* Native Dependencies */
import {normalizeFederationEnums, type NormalizedFederation} from '#server/modules/federation/helpers/federation-enums.helpers';

/* Local Dependencies */
import type {FederationModeResult} from './federation.types.js';

@Injectable()
export class FederationService {
	constructor(
		private configService: ConfigService,
		private cdkRpcService: CdkRpcService,
	) {}

	/* *******************************************************
        Mode
    ******************************************************** */

	/** Probe both services at once: setup mode answers one, a federation member the other, a standalone mint neither. */
	public async getMode(): Promise<FederationModeResult> {
		if (this.configService.get<string>('cashu.type') !== MintType.CDK) return {mode: 'standalone', details: null};
		// cdk-mintd's management RPC is optional; without it the database and public API pages still work
		if (!this.configService.get('cashu.rpc_host') || !this.configService.get('cashu.rpc_port'))
			return {mode: 'standalone', details: null};
		const [setup, info] = await Promise.allSettled([
			this.cdkRpcService.request('GetSetupStatus', {}, 5000),
			this.cdkRpcService.request('GetFederationInfo', {}, 5000),
		]);
		if (setup.status === 'fulfilled') return {mode: 'setup', details: null};
		if (info.status === 'fulfilled') return {mode: 'member', details: null};
		const error = info.reason;
		const unimplemented = (reason: unknown): boolean => reason instanceof CdkRpcError && reason.grpc_code === status.UNIMPLEMENTED;
		// A setup daemon serves only the setup service, so it is still in setup when its status call is slow or busy
		if (unimplemented(error)) return {mode: unimplemented(setup.reason) ? 'standalone' : 'setup', details: null};
		if (error instanceof CdkRpcError && error.grpc_code === status.FAILED_PRECONDITION) return {mode: 'standalone', details: null};
		if (error instanceof CdkRpcError && [status.UNAVAILABLE, status.DEADLINE_EXCEEDED].includes(error.grpc_code))
			return {mode: 'unreachable', details: error.details};
		throw error;
	}

	/* *******************************************************
        Member status
    ******************************************************** */

	/** Read the current public federation configuration. */
	public async getInfo(): Promise<NormalizedFederation<CdkRpcMethods['GetFederationInfo']['response']>> {
		return normalizeFederationEnums(await this.cdkRpcService.request('GetFederationInfo', {}));
	}

	/** Read local consensus and checkpoint state without contacting peers. */
	public async getLocalStatus(): Promise<NormalizedFederation<CdkRpcMethods['GetLocalStatus']['response']>> {
		return normalizeFederationEnums(await this.cdkRpcService.request('GetLocalStatus', {}));
	}

	/** Read peer statuses and digest comparisons; CDK owns the short-lived snapshot cache. */
	public async getMemberStatuses(): Promise<NormalizedFederation<CdkRpcMethods['GetMemberStatuses']['response']>> {
		return normalizeFederationEnums(await this.cdkRpcService.request('GetMemberStatuses', {}));
	}

	/** Read optional custody backends without substituting missing sections. */
	public async getCustodyStatus(): Promise<NormalizedFederation<CdkRpcMethods['GetCustodyStatus']['response']>> {
		return normalizeFederationEnums(await this.cdkRpcService.request('GetCustodyStatus', {}));
	}

	/** Prevent standalone-only operations through GraphQL, agents, or other callers. */
	public async assertStandaloneOperation(): Promise<void> {
		const result = await this.getMode();
		if (result.mode === 'unreachable') throw new CdkRpcError(status.UNAVAILABLE, result.details);
		if (result.mode !== 'standalone')
			throw new CdkRpcError(
				status.FAILED_PRECONDITION,
				'Keyset rotation, quote state overrides and database restores are unavailable for federation setup and members',
			);
	}
}
