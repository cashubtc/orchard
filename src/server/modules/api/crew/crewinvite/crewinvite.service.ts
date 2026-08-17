/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {InviteService} from '#server/modules/invite/invite.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardCrewInvite} from './crewinvite.model.js';
import {InviteCreateInput, InviteUpdateInput} from './crewinvite.input.js';

@Injectable()
export class CrewInviteService {
	private readonly logger = new Logger(CrewInviteService.name);

	constructor(
		private errorService: ErrorService,
		private inviteService: InviteService,
	) {}

	async getInvites(tag: string): Promise<OrchardCrewInvite[]> {
		try {
			const invites = await this.inviteService.getInvites();
			return invites.map((invite) => new OrchardCrewInvite(invite));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.InviteError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async createInvite(tag: string, user_id: string, createInvite: InviteCreateInput): Promise<OrchardCrewInvite> {
		try {
			const invite = await this.inviteService.createInvite(user_id, createInvite.role, createInvite.label, createInvite.expires_at);
			return new OrchardCrewInvite(invite);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.InviteError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateInvite(tag: string, updateInvite: InviteUpdateInput): Promise<OrchardCrewInvite> {
		try {
			const invite = await this.inviteService.updateInvite(updateInvite.id, updateInvite);
			return new OrchardCrewInvite(invite);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.InviteError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async deleteInvite(tag: string, invite_id: string): Promise<void> {
		try {
			await this.inviteService.deleteInvite(invite_id);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.InviteError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
