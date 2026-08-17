/* Core Dependencies */
import {InputType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';

@InputType({description: "Input for updating a user's name"})
export class UserNameUpdateInput {
	@Field({description: 'New username'})
	name: string;
}

@InputType({description: "Input for updating a user's password"})
export class UserPasswordUpdateInput {
	@Field({description: 'Current password for verification'})
	password_old: string;

	@Field({description: 'New password to set'})
	password_new: string;
}

@InputType({description: 'Input for admin user updates'})
export class UserUpdateInput {
	@Field({description: 'ID of the user to update'})
	id: string;

	@Field({nullable: true, description: 'Optional display label for the user'})
	label?: string;

	@Field(() => UserRole, {nullable: true, description: 'New role for the user'})
	role?: UserRole;

	@Field(() => Boolean, {nullable: true, description: 'Whether the user account is active'})
	active?: boolean;
}
