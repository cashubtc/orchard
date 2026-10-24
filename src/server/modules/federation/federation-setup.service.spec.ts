import {Test} from '@nestjs/testing';
import {status} from '@grpc/grpc-js';
import {CdkRpcError, CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {FederationSetupService} from './federation-setup.service.js';

describe('FederationSetupService', () => {
	let service: FederationSetupService;
	const request = jest.fn();
	const input = {members: 3, threshold: 2, network: 'regtest'};
	const created = {
		setup_id: 'setup',
		invitations: [
			{member_id: 2, invitation: 'secret-2'},
			{member_id: 3, invitation: 'secret-3'},
		],
	};
	const progress = {initialized: true, setup_id: 'setup', enrolled_members: [1], participant_phase: 'enrolled'};
	beforeEach(async () => {
		request.mockReset();
		const module = await Test.createTestingModule({
			providers: [FederationSetupService, {provide: CdkRpcService, useValue: {request}}],
		}).compile();
		service = module.get(FederationSetupService);
	});
	afterEach(() => jest.useRealTimers());
	it('retains invitations across refreshes and permanently removes enrolled slots', async () => {
		request.mockResolvedValueOnce(structuredClone(created));
		await service.create(input);
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations).toEqual(created.invitations);
		expect((await service.getStatus()).invitations).toEqual(created.invitations);
		request.mockResolvedValue({...progress, enrolled_members: [1, 2]});
		expect((await service.getStatus()).invitations).toEqual([created.invitations[1]]);
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations).toEqual([created.invitations[1]]);
	});
	it('does not clear newly created invitations when an older status request finishes late', async () => {
		let finish_status!: (value: object) => void;
		request.mockReturnValueOnce(
			new Promise((resolve) => {
				finish_status = resolve;
			}),
		);
		const pending = service.getStatus();
		request.mockResolvedValueOnce(created);
		await service.create(input);
		finish_status({initialized: false});
		expect((await pending).invitations).toEqual([]);
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations).toEqual(created.invitations);
	});
	it('stops returning invitations once they expire', async () => {
		jest.useFakeTimers({now: new Date('2026-10-23T00:00:00Z')});
		request.mockResolvedValueOnce(created);
		await service.create(input);
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations_expires_at).toBe(Date.parse('2026-10-24T00:00:00Z') / 1000);
		jest.setSystemTime(new Date('2026-10-24T00:00:00Z'));
		expect((await service.getStatus()).invitations).toEqual([]);
	});
	it.each([{initialized: false}, {setup_id: 'another'}, {participant_phase: 'aborted'}, {activation: {restart_pending: true}}])(
		'forgets obsolete secrets: %s',
		async (update) => {
			request.mockResolvedValueOnce(created);
			await service.create(input);
			request.mockResolvedValue({...progress, ...update});
			expect((await service.getStatus()).invitations).toEqual([]);
		},
	);
	it('cannot recover invitations after process state is gone', async () => {
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations).toEqual([]);
	});
	it('does not discard invitations when create fails', async () => {
		request.mockResolvedValueOnce(created);
		await service.create(input);
		request.mockRejectedValueOnce(new CdkRpcError(status.FAILED_PRECONDITION, 'Already initialized'));
		await expect(service.create(input)).rejects.toThrow('Already initialized');
		request.mockResolvedValue(progress);
		expect((await service.getStatus()).invitations).toEqual(created.invitations);
	});
	it('passes uint64 strings through without rounding', async () => {
		request.mockResolvedValue(created);
		const keyset = {unit: 'sat', amounts: ['18446744073709551615'], input_fee_ppk: '9007199254740993'};
		await service.create({...input, keyset});
		expect(request).toHaveBeenCalledWith('CreateSetup', {...input, keyset}, 120000);
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
		expect(request.mock.calls).toEqual([
			['JoinSetup', {invitation: 'secret'}, 120000],
			['ProposeSetup', {}, 120000],
			['ReviewProposal', {}],
			['ApproveProposal', {proposal_hash: 'exact-hash'}, 120000],
			['ActivateSetup', {}, 120000],
		]);
		const error = new CdkRpcError(status.INVALID_ARGUMENT, 'Invitation expired');
		request.mockRejectedValue(error);
		await expect(service.join({invitation: 'expired'})).rejects.toBe(error);
	});
});
