/* Core Dependencies */
import {Injectable, ExecutionContext} from '@nestjs/common';
import {CanActivate} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {GqlExecutionContext} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '#server/modules/user/user.enums';
/* Native Dependencies */
import {ROLES_KEY, PUBLIC_KEY} from '#server/modules/auth/decorators/auth.decorator';

/**
 * Authorization guard that verifies user permissions
 * This guard checks if the user has the required roles to access a resource
 */
@Injectable()
export class GqlAuthorizationGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	/**
	 * Determine if the request can proceed based on user roles
	 * @param {ExecutionContext} context - The execution context
	 * @returns {boolean} Whether the request can proceed
	 */
	canActivate(context: ExecutionContext): boolean {
		const is_public = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (is_public) return true;
		const required_roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
		if (!required_roles || required_roles.length === 0) return true;
		const ctx = GqlExecutionContext.create(context);
		const {user} = ctx.getContext().req;
		if (!user) throw new OrchardApiError(OrchardErrorCode.AuthenticationError);
		const has_role = required_roles.some((role) => user.role === role);
		if (!has_role) throw new OrchardApiError(OrchardErrorCode.AuthorizationError);
		return true;
	}
}
