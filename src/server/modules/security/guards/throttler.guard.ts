/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {GqlExecutionContext} from '@nestjs/graphql';
import {ThrottlerGuard, ThrottlerRequest} from '@nestjs/throttler';
/* Application Dependencies */
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardErrorCode} from '#server/modules/error/error.types';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
	async handleRequest(request: ThrottlerRequest): Promise<boolean> {
		const gqlCtx = GqlExecutionContext.create(request.context);
		const {req, connection} = gqlCtx.getContext();
		const httpRequest = connection?.context?.req ? connection.context.req : req;
		const ip = this.getClientIp(httpRequest);
		const key = this.generateKey(request.context, ip, request.throttler.name);
		const {totalHits} = await this.storageService.increment(
			key,
			Number(request.ttl),
			Number(request.limit),
			Number(request.ttl),
			request.throttler.name || 'default',
		);
		if (totalHits >= Number(request.limit)) throw new OrchardApiError(OrchardErrorCode.ThrottlerError);
		return true;
	}

	private getClientIp(request: any): string {
		if (!request) return 'unknown';
		return (
			request.ip ||
			request.connection?.remoteAddress ||
			request.socket?.remoteAddress ||
			request.connection?.socket?.remoteAddress ||
			'unknown'
		);
	}
}
