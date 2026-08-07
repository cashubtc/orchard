/* Core Dependencies */
import {ObjectType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardAuthToken} from '#server/modules/auth/auth.types';

@ObjectType({description: 'Authentication token pair for API access'})
export class OrchardAuthentication {
	@Field({description: 'JWT access token for authenticated requests'})
	access_token: string;

	@Field({description: 'JWT refresh token for obtaining new access tokens'})
	refresh_token: string;

	constructor(token: OrchardAuthToken) {
		this.access_token = token.access_token;
		this.refresh_token = token.refresh_token;
	}
}
