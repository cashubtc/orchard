/* Core Dependencies */
import {Injectable} from '@nestjs/common';

/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';
import {DateTime} from 'luxon';

/* Application Dependencies */
import {CdkRpcError, CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import type {CdkRpcMethods} from '#server/modules/cashu/cdk/cdkrpc.types';

type SetupStatus = CdkRpcMethods['GetSetupStatus']['response'];
type Invitation = CdkRpcMethods['CreateSetup']['response']['invitations'][number];
export type SetupStatusWithInvitations = SetupStatus & {invitations: Invitation[]; invitations_expires_at?: number};

/** Setup mutations wait on other members over the federation network. */
const SETUP_ACTION_TIMEOUT_MS = 120000;
/** cdk's default invitation lifetime, which Orchard never overrides. */
const INVITATION_LIFETIME_SECS = 86400;

/** Protobuf silently wraps out-of-range uint64 values, so stop them before they reach the mint. */
function assertUint64(value: string | number | null | undefined, field: string): void {
	if (value == null) return;
	const text = String(value);
	if (!/^\d+$/.test(text) || BigInt(text) > 18446744073709551615n) {
		throw new CdkRpcError(status.INVALID_ARGUMENT, `${field} must be a whole number from 0 to 18446744073709551615, got "${text}"`);
	}
}

@Injectable()
export class FederationSetupService {
	private setup_id: string | null = null;
	private invitations = new Map<number, Invitation>();
	private expires_at = 0;

	constructor(private cdkRpcService: CdkRpcService) {}

	/* *******************************************************
        Setup
    ******************************************************** */

	/** Create once and retain unused invitation secrets only in this process. */
	public async create(input: CdkRpcMethods['CreateSetup']['request']): Promise<CdkRpcMethods['CreateSetup']['response']> {
		assertUint64(input.keyset?.input_fee_ppk, 'Input fee');
		assertUint64(input.keyset?.final_expiry, 'Keyset expiry');
		input.keyset?.amounts?.forEach((amount) => assertUint64(amount, 'Denomination'));
		const started_at = DateTime.now().toUnixInteger();
		const response = await this.cdkRpcService.request('CreateSetup', input, SETUP_ACTION_TIMEOUT_MS);
		this.setup_id = response.setup_id;
		this.invitations = new Map(response.invitations.map((invitation) => [invitation.member_id, invitation]));
		this.expires_at = started_at + INVITATION_LIFETIME_SECS;
		return response;
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

	/** Prune enrolled, expired, or obsolete invitations before exposing setup status. */
	public async getStatus(): Promise<SetupStatusWithInvitations> {
		const requested_setup_id = this.setup_id;
		const response = await this.cdkRpcService.request('GetSetupStatus', {});
		if (this.setup_id !== requested_setup_id) return {...response, invitations: []};
		const obsolete =
			!response.initialized ||
			response.setup_id !== this.setup_id ||
			DateTime.now().toUnixInteger() >= this.expires_at ||
			response.participant_phase === 'aborted' ||
			response.coordinator_phase === 'aborted' ||
			!!response.activation;
		if (obsolete) this.clearInvitations();
		else response.enrolled_members.forEach((member_id) => this.invitations.delete(member_id));
		return {
			...response,
			invitations: [...this.invitations.values()],
			invitations_expires_at: this.invitations.size ? this.expires_at : undefined,
		};
	}

	/** Activate locally; no process management or mint files are touched by Orchard. */
	public async activate(): Promise<CdkRpcMethods['ActivateSetup']['response']> {
		const response = await this.cdkRpcService.request('ActivateSetup', {}, SETUP_ACTION_TIMEOUT_MS);
		this.clearInvitations();
		return response;
	}

	/* *******************************************************
        Invitations
    ******************************************************** */

	/** Drop every retained invitation. */
	private clearInvitations(): void {
		this.invitations.clear();
		this.setup_id = null;
		this.expires_at = 0;
	}
}
