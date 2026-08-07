/* Core Dependencies */
import {ObjectType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {Invite} from '@server/modules/invite/invite.entity';
import {UserRole} from '@server/modules/user/user.enums';
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Crew invite for onboarding new users'})
export class OrchardCrewInvite {
	@Field({description: 'Unique invite identifier'})
	id: string;

	@Field({description: '12-character invite code'})
	token: string;

	@Field(() => String, {nullable: true, description: 'Suggested username or label for the invitee'})
	label: string | null;

	@Field(() => UserRole, {description: 'Role to assign when the invite is claimed'})
	role: UserRole;

	@Field({description: 'ID of the admin who created the invite'})
	created_by_id: string;

	@Field(() => String, {nullable: true, description: 'ID of the user who claimed the invite'})
	claimed_by_id: string | null;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when the invite was claimed'})
	used_at: number | null;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when the invite expires'})
	expires_at: number | null;

	@Field(() => UnixTimestamp, {description: 'Timestamp when the invite was created'})
	created_at: number;

	constructor(invite: Invite) {
		this.id = invite.id;
		this.token = invite.token;
		this.label = invite.label;
		this.role = invite.role;
		this.created_by_id = invite.created_by.id;
		this.claimed_by_id = invite.claimed_by?.id || null;
		this.used_at = invite.used_at;
		this.expires_at = invite.expires_at;
		this.created_at = invite.created_at;
	}
}
