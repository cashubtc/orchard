/* Core Dependencies */
import {Injectable, ExecutionContext} from '@nestjs/common';
import {AuthGuard} from '@nestjs/passport';
import {GqlExecutionContext} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';

@Injectable()
export class GqlRefreshGuard extends AuthGuard('jwt-refresh') {
	getRequest(context: ExecutionContext) {
		const ctx = GqlExecutionContext.create(context);
		return ctx.getContext().req;
	}

	handleRequest(err: any, user: any) {
		if (err || !user) throw new OrchardApiError(OrchardErrorCode.AuthenticationExpiredError);
		return user;
	}
}
