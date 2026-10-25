import 'reflect-metadata';
import {ServiceConfigResolver} from './service-config.resolver.js';
import {UserRole} from '#server/modules/user/user.enums';

describe('ServiceConfigResolver authorization', () => {
	it.each(['service_configurations', 'service_connection_test', 'service_configuration_save', 'service_configuration_remove'] as const)(
		'%s is administrator-only',
		(method) => {
			expect(Reflect.getMetadata('roles', ServiceConfigResolver.prototype[method])).toEqual([UserRole.ADMIN]);
		},
	);
});
