/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {ErrorService} from '@server/modules/error/error.service';
import {InviteService} from '@server/modules/invite/invite.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '@server/modules/user/user.enums';
import {User} from '@server/modules/user/user.entity';
import {Invite} from '@server/modules/invite/invite.entity';
/* Local Dependencies */
import {CrewInviteService} from './crewinvite.service.js';
import {OrchardCrewInvite} from './crewinvite.model.js';
import {InviteCreateInput, InviteUpdateInput} from './crewinvite.input.js';

describe('CrewInviteService', () => {
	let crewInviteService: CrewInviteService;
	let inviteService: jest.Mocked<InviteService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CrewInviteService,
				{
					provide: InviteService,
					useValue: {
						getInvites: jest.fn(),
						createInvite: jest.fn(),
						updateInvite: jest.fn(),
						deleteInvite: jest.fn(),
					},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		crewInviteService = module.get<CrewInviteService>(CrewInviteService);
		inviteService = module.get(InviteService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(crewInviteService).toBeDefined();
	});

	describe('getInvites', () => {
		it('returns array of OrchardCrewInvite models', async () => {
			const mock_invites = [
				{
					id: '1',
					token: 'ABC123DEF456',
					label: 'Test Invite',
					role: UserRole.READER,
					created_by: {id: 'user1'} as User,
					claimed_by: null,
					used_at: null,
					expires_at: null,
					created_at: Math.floor(DateTime.now().toSeconds()),
				} as Invite,
				{
					id: '2',
					token: 'GHI789JKL012',
					label: 'Manager Invite',
					role: UserRole.MANAGER,
					created_by: {id: 'user1'} as User,
					claimed_by: null,
					used_at: null,
					expires_at: Math.floor(DateTime.now().plus({days: 7}).toSeconds()),
					created_at: Math.floor(DateTime.now().toSeconds()),
				} as Invite,
			];

			inviteService.getInvites.mockResolvedValue(mock_invites);

			const result = await crewInviteService.getInvites('TEST_TAG');

			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(OrchardCrewInvite);
			expect(result[0].id).toBe('1');
			expect(result[0].token).toBe('ABC123DEF456');
			expect(result[0].created_by_id).toBe('user1');
			expect(result[1]).toBeInstanceOf(OrchardCrewInvite);
			expect(result[1].id).toBe('2');
			expect(inviteService.getInvites).toHaveBeenCalled();
		});

		it('returns empty array when no invites', async () => {
			inviteService.getInvites.mockResolvedValue([]);

			const result = await crewInviteService.getInvites('TEST_TAG');

			expect(result).toHaveLength(0);
		});

		it('throws OrchardApiError when service fails', async () => {
			const error = new Error('Database error');
			inviteService.getInvites.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InviteError});

			await expect(crewInviteService.getInvites('ERROR_TAG')).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.InviteError,
			});
		});
	});

	describe('createInvite', () => {
		it('creates invite and returns OrchardCrewInvite model', async () => {
			const create_input: InviteCreateInput = {
				label: 'New Invite',
				role: UserRole.READER,
				expires_at: Math.floor(DateTime.now().plus({days: 30}).toSeconds()),
			};

			const mock_created_invite = {
				id: '123',
				token: 'NEW123TOKEN4',
				label: 'New Invite',
				role: UserRole.READER,
				created_by: {id: 'admin1'} as User,
				claimed_by: null,
				used_at: null,
				expires_at: create_input.expires_at,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			inviteService.createInvite.mockResolvedValue(mock_created_invite);

			const result = await crewInviteService.createInvite('CREATE_TAG', 'admin1', create_input);

			expect(result).toBeInstanceOf(OrchardCrewInvite);
			expect(result.id).toBe('123');
			expect(result.token).toBe('NEW123TOKEN4');
			expect(result.label).toBe('New Invite');
			expect(result.role).toBe(UserRole.READER);
			expect(result.created_by_id).toBe('admin1');
			expect(inviteService.createInvite).toHaveBeenCalledWith('admin1', UserRole.READER, 'New Invite', create_input.expires_at);
		});

		it('creates invite with minimal input', async () => {
			const create_input: InviteCreateInput = {
				role: UserRole.MANAGER,
			};

			const mock_created_invite = {
				id: '456',
				token: 'MIN123TOKEN4',
				label: null,
				role: UserRole.MANAGER,
				created_by: {id: 'admin2'} as User,
				claimed_by: null,
				used_at: null,
				expires_at: null,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			inviteService.createInvite.mockResolvedValue(mock_created_invite);

			const result = await crewInviteService.createInvite('CREATE_TAG', 'admin2', create_input);

			expect(result).toBeInstanceOf(OrchardCrewInvite);
			expect(result.label).toBeNull();
			expect(result.expires_at).toBeNull();
			expect(inviteService.createInvite).toHaveBeenCalledWith('admin2', UserRole.MANAGER, undefined, undefined);
		});

		it('throws OrchardApiError when creation fails', async () => {
			const create_input: InviteCreateInput = {
				role: UserRole.READER,
			};

			const error = new Error('Creation failed');
			inviteService.createInvite.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InviteError});

			await expect(crewInviteService.createInvite('ERROR_TAG', 'admin1', create_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.InviteError,
			});
		});
	});

	describe('updateInvite', () => {
		it('updates invite and returns OrchardCrewInvite model', async () => {
			const update_input: InviteUpdateInput = {
				id: '789',
				label: 'Updated Label',
				role: UserRole.MANAGER,
				expires_at: Math.floor(DateTime.now().plus({days: 14}).toSeconds()),
			};

			const mock_updated_invite = {
				id: '789',
				token: 'UPD123TOKEN4',
				label: 'Updated Label',
				role: UserRole.MANAGER,
				created_by: {id: 'admin1'} as User,
				claimed_by: null,
				used_at: null,
				expires_at: update_input.expires_at,
				created_at: Math.floor(DateTime.now().minus({days: 1}).toSeconds()),
			} as Invite;

			inviteService.updateInvite.mockResolvedValue(mock_updated_invite);

			const result = await crewInviteService.updateInvite('UPDATE_TAG', update_input);

			expect(result).toBeInstanceOf(OrchardCrewInvite);
			expect(result.id).toBe('789');
			expect(result.label).toBe('Updated Label');
			expect(result.role).toBe(UserRole.MANAGER);
			expect(inviteService.updateInvite).toHaveBeenCalledWith('789', update_input);
		});

		it('updates invite with partial fields', async () => {
			const update_input: InviteUpdateInput = {
				id: '999',
				label: 'Only Label Changed',
				role: UserRole.READER,
			};

			const mock_updated_invite = {
				id: '999',
				token: 'PARTIAL12TOK',
				label: 'Only Label Changed',
				role: UserRole.READER,
				created_by: {id: 'admin1'} as User,
				claimed_by: null,
				used_at: null,
				expires_at: null,
				created_at: Math.floor(DateTime.now().minus({days: 2}).toSeconds()),
			} as Invite;

			inviteService.updateInvite.mockResolvedValue(mock_updated_invite);

			const result = await crewInviteService.updateInvite('UPDATE_TAG', update_input);

			expect(result).toBeInstanceOf(OrchardCrewInvite);
			expect(result.label).toBe('Only Label Changed');
			expect(inviteService.updateInvite).toHaveBeenCalledWith('999', update_input);
		});

		it('throws OrchardApiError when update fails', async () => {
			const update_input: InviteUpdateInput = {
				id: 'invalid',
				role: UserRole.READER,
			};

			const error = new Error('Update failed');
			inviteService.updateInvite.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InviteError});

			await expect(crewInviteService.updateInvite('ERROR_TAG', update_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.InviteError,
			});
		});
	});

	describe('deleteInvite', () => {
		it('deletes invite successfully', async () => {
			inviteService.deleteInvite.mockResolvedValue(undefined);

			await crewInviteService.deleteInvite('DELETE_TAG', '123');

			expect(inviteService.deleteInvite).toHaveBeenCalledWith('123');
		});

		it('throws OrchardApiError when deletion fails', async () => {
			const error = new Error('Deletion failed');
			inviteService.deleteInvite.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InviteError});

			await expect(crewInviteService.deleteInvite('ERROR_TAG', 'invalid')).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.InviteError,
			});
		});
	});
});
