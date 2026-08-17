/* Core Dependencies */
import {InputType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

@InputType({description: 'Input for creating a crew invite'})
export class InviteCreateInput {
	@Field({nullable: true, description: 'Suggested username or label for the invitee'})
	label?: string;

	@Field(() => UserRole, {description: 'Role to assign when the invite is claimed'})
	role: UserRole;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Expiration timestamp for the invite'})
	expires_at?: number;
}

@InputType({description: 'Input for updating a crew invite'})
export class InviteUpdateInput {
	@Field({description: 'ID of the invite to update'})
	id: string;

	@Field({nullable: true, description: 'Updated label for the invitee'})
	label?: string;

	@Field(() => UserRole, {nullable: true, description: 'Updated role for the invite'})
	role: UserRole;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Updated expiration timestamp'})
	expires_at?: number;
}
