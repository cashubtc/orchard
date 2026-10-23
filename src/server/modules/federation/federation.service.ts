/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import {CdkRpcError, CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';

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
		if (this.configService.get<string>('cashu.type') !== 'cdk') return {mode: 'standalone', details: null};
		const [setup, info] = await Promise.allSettled([
			this.cdkRpcService.request('GetSetupStatus', {}, 5000),
			this.cdkRpcService.request('GetFederationInfo', {}, 5000),
		]);
		if (setup.status === 'fulfilled') return {mode: 'setup', details: null};
		if (info.status === 'fulfilled') return {mode: 'member', details: null};
		const error = info.reason;
		if (error instanceof CdkRpcError && error.grpc_code === status.FAILED_PRECONDITION) return {mode: 'standalone', details: null};
		if (error instanceof CdkRpcError && [status.UNAVAILABLE, status.DEADLINE_EXCEEDED].includes(error.grpc_code))
			return {mode: 'unreachable', details: error.details};
		throw error;
	}

	/** Prevent standalone-only operations through GraphQL, agents, or other callers. */
	public async assertStandaloneOperation(): Promise<void> {
		const result = await this.getMode();
		if (result.mode === 'unreachable') throw new CdkRpcError(status.UNAVAILABLE, result.details);
		if (result.mode !== 'standalone')
			throw new CdkRpcError(
				status.FAILED_PRECONDITION,
				'Keyset rotation and quote state overrides are unavailable for federation setup and members',
			);
	}
}
