/* Core Dependencies */
import {GUARDS_METADATA} from '@nestjs/common/constants';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {PUBLIC_KEY} from '#server/modules/auth/decorators/auth.decorator';
import {GqlRefreshGuard} from '#server/modules/security/guards/refresh.guard';
/* Local Dependencies */
import {AuthAuthenticationResolver} from './authentication.resolver.js';

describe('AuthAuthenticationResolver guard metadata', () => {
	/**
	 * The global access-token guard rejects refresh tokens (AuthStrategy enforces
	 * payload.type === 'access'), so the refresh/revoke mutations must be @Public
	 * to remain reachable, relying on the route-level GqlRefreshGuard for auth.
	 */
	it.each(['auth_authentication_refresh', 'auth_authentication_revoke'] as const)(
		'%s is public and guarded by GqlRefreshGuard',
		(method) => {
			const handler = AuthAuthenticationResolver.prototype[method];
			const is_public = Reflect.getMetadata(PUBLIC_KEY, handler);
			const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

			expect(is_public).toBe(true);
			expect(guards).toContain(GqlRefreshGuard);
		},
	);
});
