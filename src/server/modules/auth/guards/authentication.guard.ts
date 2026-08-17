/* Core Dependencies */
import {Injectable, type ExecutionContext} from '@nestjs/common';
import {AuthGuard} from '@nestjs/passport';
import {GqlExecutionContext} from '@nestjs/graphql';
import {Reflector} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '#server/modules/user/user.enums';
import {AuthService} from '#server/modules/auth/auth.service';
/* Native Dependencies */
import {PUBLIC_KEY} from '#server/modules/auth/decorators/auth.decorator';

@Injectable()
export class GqlAuthenticationGuard extends AuthGuard('jwt') {
	constructor(
		private configService: ConfigService,
		private reflector: Reflector,
		private authService: AuthService,
	) {
		super();
	}
	getRequest(context: ExecutionContext) {
		const ctx = GqlExecutionContext.create(context);
		return ctx.getContext().req;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const is_public = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (is_public) return true;

		const gql_ctx = GqlExecutionContext.create(context);
		const info = gql_ctx.getInfo?.();
		const is_subscription = info?.operation?.operation === 'subscription';
		if (is_subscription) return this.handleSubscription(gql_ctx);

		const request = this.getRequest(context);
		if (request?.internal && request.user) return true;
		return (await super.canActivate(context)) as boolean;
	}

	/**
	 * Authenticates a GraphQL subscription by reading the access token from
	 * the graphql-ws connectionParams, validating it, and attaching a user
	 * object to the request in the same shape the HTTP passport-jwt path uses.
	 */
	private async handleSubscription(gql_ctx: GqlExecutionContext): Promise<boolean> {
		const request = gql_ctx.getContext().req;
		const token = request?.connectionParams?.authorization;
		const dev_auth_bypass = this.configService.get<boolean>('mode.dev_auth_bypass');

		if (!token) {
			if (dev_auth_bypass) {
				request.user = {id: 'dev-user', name: 'dev', role: UserRole.ADMIN};
				return true;
			}
			throw new OrchardApiError(OrchardErrorCode.AuthenticationError);
		}

		try {
			const payload = await this.authService.validateAccessToken(token);
			request.user = {
				id: payload.sub,
				name: payload.username,
				role: payload.role,
				auth_token: token,
			};
			return true;
		} catch {
			throw new OrchardApiError(OrchardErrorCode.AuthenticationError);
		}
	}

	handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
		const dev_auth_bypass = this.configService.get<boolean>('mode.dev_auth_bypass');
		if (dev_auth_bypass && !user && !err) {
			const request = this.getRequest(context);
			const has_auth_header = request.headers?.authorization;
			if (!has_auth_header) return {id: 'dev-user', name: 'dev', role: UserRole.ADMIN};
		}
		if (err || !user) throw new OrchardApiError(OrchardErrorCode.AuthenticationError);
		return user;
	}
}
