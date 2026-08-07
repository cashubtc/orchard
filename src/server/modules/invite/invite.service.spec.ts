/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Vendor Dependencies */
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {UserRole} from '@server/modules/user/user.enums';
import {User} from '@server/modules/user/user.entity';
/* Local Dependencies */
import {InviteService} from './invite.service.js';
import {Invite} from './invite.entity.js';

describe('InviteService', () => {
	let inviteService: InviteService;
	let mock_repository: any;

	beforeEach(async () => {
		mock_repository = {
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [InviteService, {provide: getRepositoryToken(Invite), useValue: mock_repository}],
		}).compile();

		inviteService = module.get<InviteService>(InviteService);
	});

	it('should be defined', () => {
		expect(inviteService).toBeDefined();
	});

	describe('getInvites', () => {
		it('returns all active invites', async () => {
			const mock_invites = [
				{
					id: '1',
					token: 'ABC123DEF456',
					label: 'Test Invite',
					role: UserRole.READER,
					used_at: null,
					expires_at: null,
					created_by: {id: 'user1'} as User,
				} as Invite,
				{
					id: '2',
					token: 'GHI789JKL012',
					label: 'Another Invite',
					role: UserRole.MANAGER,
					used_at: null,
					expires_at: Math.floor(DateTime.now().plus({days: 7}).toSeconds()),
					created_by: {id: 'user1'} as User,
				} as Invite,
			];
			mock_repository.find.mockResolvedValue(mock_invites);

			const invites = await inviteService.getInvites();

			expect(invites).toHaveLength(2);
			expect(invites[0].token).toBe('ABC123DEF456');
			expect(invites[1].token).toBe('GHI789JKL012');
			expect(mock_repository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					relations: ['created_by'],
					order: {created_at: 'DESC'},
				}),
			);
		});

		it('returns empty array when no active invites', async () => {
			mock_repository.find.mockResolvedValue([]);

			const invites = await inviteService.getInvites();

			expect(invites).toHaveLength(0);
		});
	});

	describe('createInvite', () => {
		it('creates invite with default values', async () => {
			const mock_created_invite = {
				id: '1',
				token: 'ABC123DEF456',
				label: null,
				role: UserRole.READER,
				created_by: {id: 'user1'} as User,
				expires_at: null,
				used_at: null,
				claimed_by: null,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			mock_repository.findOne.mockResolvedValue(null); // token doesn't exist
			mock_repository.create.mockReturnValue(mock_created_invite);
			mock_repository.save.mockResolvedValue(mock_created_invite);

			const invite = await inviteService.createInvite('user1');

			expect(invite.role).toBe(UserRole.READER);
			expect(invite.label).toBeNull();
			expect(invite.expires_at).toBeNull();
			expect(invite.used_at).toBeNull();
			expect(mock_repository.save).toHaveBeenCalled();
		});

		it('creates invite with custom values', async () => {
			const expires_at = Math.floor(DateTime.now().plus({days: 30}).toSeconds());
			const mock_created_invite = {
				id: '2',
				token: 'XYZ987WVU654',
				label: 'Custom Label',
				role: UserRole.MANAGER,
				created_by: {id: 'admin1'} as User,
				expires_at,
				used_at: null,
				claimed_by: null,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.create.mockReturnValue(mock_created_invite);
			mock_repository.save.mockResolvedValue(mock_created_invite);

			const invite = await inviteService.createInvite('admin1', UserRole.MANAGER, 'Custom Label', expires_at);

			expect(invite.role).toBe(UserRole.MANAGER);
			expect(invite.label).toBe('Custom Label');
			expect(invite.expires_at).toBe(expires_at);
			expect(mock_repository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					label: 'Custom Label',
					role: UserRole.MANAGER,
					expires_at,
				}),
			);
		});

		it('generates unique token', async () => {
			const mock_created_invite = {
				id: '3',
				token: 'UNIQUE12CHAR',
				label: null,
				role: UserRole.READER,
				created_by: {id: 'user1'} as User,
				expires_at: null,
				used_at: null,
				claimed_by: null,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.create.mockReturnValue(mock_created_invite);
			mock_repository.save.mockResolvedValue(mock_created_invite);

			const invite = await inviteService.createInvite('user1');

			expect(invite.token).toBeDefined();
			expect(invite.token).toHaveLength(12);
		});
	});

	describe('updateInvite', () => {
		it('updates unclaimed invite successfully', async () => {
			const existing_invite = {
				id: '1',
				token: 'ABC123DEF456',
				label: 'Old Label',
				role: UserRole.READER,
				used_at: null,
				expires_at: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(existing_invite);
			mock_repository.save.mockResolvedValue({
				...existing_invite,
				label: 'New Label',
				role: UserRole.MANAGER,
			});

			const updated = await inviteService.updateInvite('1', {
				label: 'New Label',
				role: UserRole.MANAGER,
			});

			expect(updated.label).toBe('New Label');
			expect(updated.role).toBe(UserRole.MANAGER);
			expect(mock_repository.save).toHaveBeenCalled();
		});

		it('updates invite expiration', async () => {
			const existing_invite = {
				id: '1',
				token: 'ABC123DEF456',
				label: 'Test',
				role: UserRole.READER,
				used_at: null,
				expires_at: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			const new_expiration = Math.floor(DateTime.now().plus({days: 7}).toSeconds());
			mock_repository.findOne.mockResolvedValue(existing_invite);
			mock_repository.save.mockResolvedValue({
				...existing_invite,
				expires_at: new_expiration,
			});

			const updated = await inviteService.updateInvite('1', {
				expires_at: new_expiration,
			});

			expect(updated.expires_at).toBe(new_expiration);
		});

		it('throws error when invite not found', async () => {
			mock_repository.findOne.mockResolvedValue(null);

			await expect(inviteService.updateInvite('999', {label: 'New Label'})).rejects.toThrow('Invite not found');
		});

		it('throws error when updating claimed invite', async () => {
			const claimed_invite = {
				id: '1',
				token: 'ABC123DEF456',
				label: 'Claimed',
				role: UserRole.READER,
				used_at: Math.floor(DateTime.now().toSeconds()),
				claimed_by: {id: 'user2'} as User,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(claimed_invite);

			await expect(inviteService.updateInvite('1', {label: 'New Label'})).rejects.toThrow(
				'Cannot update an invite that has already been claimed',
			);
		});
	});

	describe('getValidInvite', () => {
		it('returns valid unclaimed invite', async () => {
			const valid_invite = {
				id: '1',
				token: 'VALID123TOKN',
				label: 'Valid Invite',
				role: UserRole.READER,
				used_at: null,
				expires_at: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(valid_invite);

			const invite = await inviteService.getValidInvite('VALID123TOKN');

			expect(invite).toBeDefined();
			expect(invite?.token).toBe('VALID123TOKN');
			expect(mock_repository.findOne).toHaveBeenCalledWith({
				where: {token: 'VALID123TOKN'},
				relations: ['created_by'],
			});
		});

		it('returns valid invite that expires in future', async () => {
			const future_expiry = Math.floor(DateTime.now().plus({days: 7}).toSeconds());
			const valid_invite = {
				id: '2',
				token: 'FUTURE12EXPR',
				label: 'Future Expiry',
				role: UserRole.READER,
				used_at: null,
				expires_at: future_expiry,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(valid_invite);

			const invite = await inviteService.getValidInvite('FUTURE12EXPR');

			expect(invite).toBeDefined();
			expect(invite?.expires_at).toBe(future_expiry);
		});

		it('returns null when invite not found', async () => {
			mock_repository.findOne.mockResolvedValue(null);

			const invite = await inviteService.getValidInvite('NOTFOUND123');

			expect(invite).toBeNull();
		});

		it('returns null when invite is claimed', async () => {
			const claimed_invite = {
				id: '3',
				token: 'CLAIMED12345',
				label: 'Claimed Invite',
				role: UserRole.READER,
				used_at: Math.floor(DateTime.now().toSeconds()),
				claimed_by: {id: 'user2'} as User,
				expires_at: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(claimed_invite);

			const invite = await inviteService.getValidInvite('CLAIMED12345');

			expect(invite).toBeNull();
		});

		it('returns null when invite is expired', async () => {
			const past_expiry = Math.floor(DateTime.now().minus({days: 1}).toSeconds());
			const expired_invite = {
				id: '4',
				token: 'EXPIRED12345',
				label: 'Expired Invite',
				role: UserRole.READER,
				used_at: null,
				expires_at: past_expiry,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(expired_invite);

			const invite = await inviteService.getValidInvite('EXPIRED12345');

			expect(invite).toBeNull();
		});
	});

	describe('claimInvite', () => {
		it('claims unclaimed invite successfully', async () => {
			const unclaimed_invite = {
				id: '1',
				token: 'UNCLAIM12345',
				label: 'Unclaimed',
				role: UserRole.READER,
				used_at: null,
				expires_at: null,
				claimed_by: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(unclaimed_invite);
			mock_repository.save.mockResolvedValue({
				...unclaimed_invite,
				used_at: Math.floor(DateTime.now().toSeconds()),
				claimed_by: {id: 'user2'} as User,
			});

			const claimed = await inviteService.claimInvite('1', 'user2');

			expect(claimed.used_at).toBeDefined();
			expect(claimed.claimed_by).toBeDefined();
			expect((claimed.claimed_by as User).id).toBe('user2');
			expect(mock_repository.save).toHaveBeenCalled();
		});

		it('throws error when invite not found', async () => {
			mock_repository.findOne.mockResolvedValue(null);

			await expect(inviteService.claimInvite('999', 'user2')).rejects.toThrow('Invite not found');
		});

		it('throws error when invite already claimed', async () => {
			const claimed_invite = {
				id: '1',
				token: 'CLAIMED12345',
				label: 'Already Claimed',
				role: UserRole.READER,
				used_at: Math.floor(DateTime.now().toSeconds()),
				claimed_by: {id: 'user2'} as User,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(claimed_invite);

			await expect(inviteService.claimInvite('1', 'user3')).rejects.toThrow('Invite has already been claimed');
		});
	});

	describe('deleteInvite', () => {
		it('deletes unclaimed invite successfully', async () => {
			const unclaimed_invite = {
				id: '1',
				token: 'DELETE123456',
				label: 'To Delete',
				role: UserRole.READER,
				used_at: null,
				expires_at: null,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(unclaimed_invite);
			mock_repository.remove.mockResolvedValue(unclaimed_invite);

			await inviteService.deleteInvite('1');

			expect(mock_repository.remove).toHaveBeenCalledWith(unclaimed_invite);
		});

		it('throws error when invite not found', async () => {
			mock_repository.findOne.mockResolvedValue(null);

			await expect(inviteService.deleteInvite('999')).rejects.toThrow('Invite not found');
		});

		it('throws error when deleting claimed invite', async () => {
			const claimed_invite = {
				id: '1',
				token: 'CLAIMED12345',
				label: 'Claimed',
				role: UserRole.READER,
				used_at: Math.floor(DateTime.now().toSeconds()),
				claimed_by: {id: 'user2'} as User,
				created_by: {id: 'user1'} as User,
			} as Invite;

			mock_repository.findOne.mockResolvedValue(claimed_invite);

			await expect(inviteService.deleteInvite('1')).rejects.toThrow('Cannot delete an invite that has already been claimed');
		});
	});
});
