/* Core Dependencies */
import {ObjectType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {User} from '#server/modules/user/user.entity';
import {UserRole} from '#server/modules/user/user.enums';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Crew user account'})
export class OrchardCrewUser {
	@Field({description: 'Unique user identifier'})
	id: string;

	@Field({description: 'Username'})
	name: string;

	@Field(() => UserRole, {description: 'User role determining permissions'})
	role: UserRole;

	@Field({description: 'Whether the user account is active'})
	active: boolean;

	@Field(() => String, {nullable: true, description: 'Optional display label for the user'})
	label: string | null;

	@Field(() => String, {nullable: true, description: 'Telegram chat ID for notifications'})
	telegram_chat_id: string | null;

	@Field(() => UnixTimestamp, {description: 'Account creation timestamp'})
	created_at: number;

	constructor(user: User) {
		this.id = user.id;
		this.name = user.name;
		this.role = user.role;
		this.active = user.active;
		this.label = user.label;
		this.telegram_chat_id = user.telegram_chat_id;
		this.created_at = user.created_at;
	}
}
