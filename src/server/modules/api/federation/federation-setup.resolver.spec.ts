import {Reflector} from '@nestjs/core';
import {ROLES_KEY, PUBLIC_KEY} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {FederationSetupResolver} from './federation-setup.resolver.js';

describe('FederationSetupResolver authorization', () => {
	it.each(['create', 'join', 'propose', 'approve', 'activate', 'abort', 'replaceInvitation'] as const)(
		'requires ADMIN for %s',
		(method) => {
			const targets = [FederationSetupResolver.prototype[method], FederationSetupResolver];
			const reflector = new Reflector();
			expect(reflector.getAllAndOverride(ROLES_KEY, targets)).toEqual([UserRole.ADMIN]);
			expect(reflector.getAllAndOverride(PUBLIC_KEY, targets)).not.toBe(true);
		},
	);
});

describe('FederationSetupResolver reads', () => {
	it.each(['review', 'getStatus'] as const)('allows all authenticated roles to use %s', (method) => {
		const targets = [FederationSetupResolver.prototype[method], FederationSetupResolver];
		const reflector = new Reflector();
		expect(reflector.getAllAndOverride(ROLES_KEY, targets)).toBeUndefined();
		expect(reflector.getAllAndOverride(PUBLIC_KEY, targets)).not.toBe(true);
	});
});
