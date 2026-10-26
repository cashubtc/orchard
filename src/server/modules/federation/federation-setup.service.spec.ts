import {Test} from '@nestjs/testing';
import {status} from '@grpc/grpc-js';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {CdkRpcError} from '#server/modules/cashu/cdk/classes/cdk-rpc-error.class';
import {FederationSetupService} from './federation-setup.service.js';

describe('FederationSetupService', () => {
	let service: FederationSetupService;
	const request = jest.fn();
	const input = {members: 3, threshold: 2, network: 'regtest'};
	const created = {
		setup_id: 'setup',
		invitations: [
			{member_id: 2, invitation: 'secret-2', expires_at_unix: '1792886400'},
			{member_id: 3, invitation: 'secret-3', expires_at_unix: '1792886400'},
		],
	};
	const progress = {initialized: true, setup_id: 'setup', enrolled_members: [1], participant_phase: 'SETUP_PARTICIPANT_PHASE_ENROLLED'};
	beforeEach(async () => {
		request.mockReset();
		const module = await Test.createTestingModule({
			providers: [FederationSetupService, {provide: CdkRpcService, useValue: {request}}],
		}).compile();
		service = module.get(FederationSetupService);
	});
	it('returns creation secrets only from create, not status polling', async () => {
		request.mockResolvedValueOnce(created);
		expect(await service.create(input)).toEqual(created);
		request.mockResolvedValue(progress);
		expect(await service.getStatus()).toEqual(progress);
		expect(await service.getStatus()).not.toHaveProperty('invitations');
	});
	it('normalizes absent enum values without changing known phases', async () => {
		request.mockResolvedValue({...progress, role: 'SETUP_ROLE_UNSPECIFIED', participant_phase: 'SETUP_PARTICIPANT_PHASE_UNSPECIFIED'});
		expect(await service.getStatus()).toMatchObject({role: undefined, participant_phase: undefined});
	});
	it('passes uint64 strings through without rounding', async () => {
		request.mockResolvedValue(created);
		const keyset = {unit: 'sat', amounts: ['18446744073709551615'], input_fee_ppk: '9007199254740993'};
		await service.create({...input, keyset, invitation_lifetime_secs: '604800'});
		expect(request).toHaveBeenCalledWith('CreateSetup', {...input, keyset, invitation_lifetime_secs: '604800'}, 120000);
	});
	it('rejects an invitation lifetime protobuf would wrap', async () => {
		await expect(service.create({...input, invitation_lifetime_secs: '-1'})).rejects.toMatchObject({
			grpc_code: status.INVALID_ARGUMENT,
		});
		expect(request).not.toHaveBeenCalled();
	});
	it.each(['18446744073709551616', '-1', '1.5', '1e3'])('rejects %s before protobuf can wrap it', async (amount) => {
		await expect(service.create({...input, keyset: {amounts: [amount]}})).rejects.toMatchObject({
			grpc_code: status.INVALID_ARGUMENT,
		});
		expect(request).not.toHaveBeenCalled();
	});
	it('forwards all remaining setup operations and preserves errors', async () => {
		request.mockResolvedValue({});
		await service.join({invitation: 'secret'});
		await service.propose();
		await service.review();
		await service.approve('exact-hash');
		await service.activate();
		await service.replaceInvitation(2);
		await service.abort('setup');
		expect(request.mock.calls).toEqual([
			['JoinSetup', {invitation: 'secret'}, 120000],
			['ProposeSetup', {}, 120000],
			['ReviewProposal', {}],
			['ApproveProposal', {proposal_hash: 'exact-hash'}, 120000],
			['ActivateSetup', {}, 120000],
			['ReplaceInvitation', {member_id: 2}, 120000],
			['AbortSetup', {setup_id: 'setup'}, 120000],
		]);
		const error = new CdkRpcError(status.INVALID_ARGUMENT, 'Invitation expired');
		request.mockRejectedValue(error);
		await expect(service.join({invitation: 'expired'})).rejects.toBe(error);
		await expect(service.abort('wrong-setup')).rejects.toBe(error);
		await expect(service.replaceInvitation(1)).rejects.toBe(error);
	});
});
