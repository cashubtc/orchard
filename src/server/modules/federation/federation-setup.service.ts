/* Core Dependencies */
import {Injectable} from '@nestjs/common';

/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import {CdkRpcError, CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import type {CdkRpcMethods} from '#server/modules/cashu/cdk/cdkrpc.types';

/* Native Dependencies */
import {SETUP_ACTION_TIMEOUT_MS} from '#server/modules/federation/constants/federation.constants';
import {normalizeFederationEnums, type NormalizedFederation} from '#server/modules/federation/helpers/federation-enums.helpers';

@Injectable()
export class FederationSetupService {
	constructor(private cdkRpcService: CdkRpcService) {}

	/* *******************************************************
        Setup
    ******************************************************** */

	/** Create a setup and return its invitations without retaining their secrets. */
	public async create(input: CdkRpcMethods['CreateSetup']['request']): Promise<CdkRpcMethods['CreateSetup']['response']> {
		this.assertUint64(input.keyset?.input_fee_ppk, 'Input fee');
		this.assertUint64(input.keyset?.final_expiry, 'Keyset expiry');
		input.keyset?.amounts?.forEach((amount) => this.assertUint64(amount, 'Denomination'));
		return this.cdkRpcService.request('CreateSetup', input, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Join only this daemon to the invitation's coordinator. */
	public join(input: CdkRpcMethods['JoinSetup']['request']): Promise<CdkRpcMethods['JoinSetup']['response']> {
		return this.cdkRpcService.request('JoinSetup', input, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Ask the coordinator to publish the enrolled members' proposal. */
	public propose(): Promise<CdkRpcMethods['ProposeSetup']['response']> {
		return this.cdkRpcService.request('ProposeSetup', {}, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Fetch the complete proposal and its operator fingerprints. */
	public review(): Promise<CdkRpcMethods['ReviewProposal']['response']> {
		return this.cdkRpcService.request('ReviewProposal', {});
	}

	/** Approve the exact proposal the operator reviewed. */
	public approve(proposal_hash: string): Promise<CdkRpcMethods['ApproveProposal']['response']> {
		return this.cdkRpcService.request('ApproveProposal', {proposal_hash}, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Read setup progress without adding invitation secrets to polling responses. */
	public async getStatus(): Promise<NormalizedFederation<CdkRpcMethods['GetSetupStatus']['response']>> {
		return normalizeFederationEnums(await this.cdkRpcService.request('GetSetupStatus', {}));
	}

	/** Replace an invitation; CDK enforces coordinator ownership and slot availability. */
	public replaceInvitation(member_id: number): Promise<CdkRpcMethods['ReplaceInvitation']['response']> {
		return this.cdkRpcService.request('ReplaceInvitation', {member_id}, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Abort locally; CDK enforces the setup ID and certification boundary. */
	public abort(setup_id: string): Promise<CdkRpcMethods['AbortSetup']['response']> {
		return this.cdkRpcService.request('AbortSetup', {setup_id}, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Activate locally; no process management or mint files are touched by Orchard. */
	public activate(): Promise<CdkRpcMethods['ActivateSetup']['response']> {
		return this.cdkRpcService.request('ActivateSetup', {}, SETUP_ACTION_TIMEOUT_MS);
	}

	/** Protobuf silently wraps out-of-range uint64 values, so stop them before they reach the mint. */
	private assertUint64(value: string | number | null | undefined, field: string): void {
		if (value == null) return;
		const text = String(value);
		if (!/^\d+$/.test(text) || BigInt(text) > 18446744073709551615n) {
			throw new CdkRpcError(status.INVALID_ARGUMENT, `${field} must be a whole number from 0 to 18446744073709551615, got "${text}"`);
		}
	}
}
