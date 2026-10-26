import 'reflect-metadata';
import {ServiceConfigResolver} from './service-config.resolver.js';
import {UserRole} from '#server/modules/user/user.enums';

import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import type {ServiceConfigService} from '#server/modules/service-config/service-config.service';
import type {EventLogService} from '#server/modules/event/event.service';
import {ServiceKind} from './service-config.model.js';
import type {ConnectionCheck, ConnectionInput} from '#server/modules/service-config/types/service-config.types';

describe('ServiceConfigResolver authorization', () => {
	it.each(['service_configurations', 'service_connection_test', 'service_configuration_save', 'service_configuration_remove'] as const)(
		'%s is administrator-only',
		(method) => {
			expect(Reflect.getMetadata('roles', ServiceConfigResolver.prototype[method])).toEqual([UserRole.ADMIN]);
		},
	);
});

describe('ServiceConfigResolver results and events', () => {
	const input: ConnectionInput = {service: 'bitcoin', values: [{key: 'password', value: 'private-password'}]};
	const request = {user: {id: 'admin-user'}};
	let resolver: ServiceConfigResolver;
	const save = jest.fn();
	const remove = jest.fn();
	const test = jest.fn();
	const getStatus = jest.fn();
	const getConfigurations = jest.fn();
	const logEvent = jest.fn();
	const error_service = new ErrorService();
	beforeEach(() => {
		jest.resetAllMocks();
		resolver = new ServiceConfigResolver(
			{save, remove, test, getStatus, getConfigurations} as unknown as ServiceConfigService,
			error_service,
			{logEvent} as unknown as EventLogService,
		);
	});
	it('records one value-free saved event with the service, source and user', async () => {
		save.mockResolvedValue({saved: true} as ConnectionCheck);
		await resolver.service_configuration_save(input, false, request);
		expect(logEvent).toHaveBeenCalledTimes(1);
		expect(logEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				actor_id: 'admin-user',
				entity_id: 'service.bitcoin',
				type: 'update',
				details: [{field: 'source', new_value: 'orchard', status: 'success'}],
			}),
		);
		expect(JSON.stringify(logEvent.mock.calls)).not.toContain('private-password');
	});
	it('records a value-free removal event with no remaining source', async () => {
		remove.mockResolvedValue(true);
		expect(await resolver.service_configuration_remove(ServiceKind.mint, request)).toBe(true);
		expect(logEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				actor_id: 'admin-user',
				actor_type: 'user',
				entity_id: 'service.mint',
				type: 'delete',
				details: [{field: 'source', new_value: 'none', status: 'success'}],
			}),
		);
	});
	it('attributes changes made by the agent to the agent', async () => {
		save.mockResolvedValue({saved: true} as ConnectionCheck);
		await resolver.service_configuration_save(input, false, {user: {id: 'agent-user', role: 'agent'}});
		expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({actor_id: 'agent-user', actor_type: 'agent'}));
	});
	it('does not log a test or refused save as an applied connection', async () => {
		test.mockResolvedValue({saved: false});
		save.mockResolvedValue({saved: false});
		await resolver.service_connection_test(input);
		await resolver.service_configuration_save(input, false, request);
		expect(logEvent).not.toHaveBeenCalled();
	});
	it('maps synchronous validation and asynchronous persistence errors to Orchard error codes', async () => {
		test.mockImplementation(() => {
			throw new Error('Unknown service field');
		});
		save.mockRejectedValue(new Error('Database unavailable'));
		await expect(resolver.service_connection_test(input)).rejects.toMatchObject({
			extensions: {code: OrchardErrorCode.SettingError, details: 'Unknown service field'},
		});
		await expect(resolver.service_configuration_save(input, false, request)).rejects.toMatchObject({
			extensions: {code: OrchardErrorCode.SettingError, details: 'Database unavailable'},
		});
		expect(logEvent).not.toHaveBeenCalled();
	});
	it.each(['service_status', 'service_configurations'] as const)('maps read failures from %s', async (method) => {
		getStatus.mockRejectedValue(new Error('Read failed'));
		getConfigurations.mockRejectedValue(new Error('Read failed'));
		await expect(resolver[method]()).rejects.toMatchObject({extensions: {code: OrchardErrorCode.SettingError, details: 'Read failed'}});
	});
});
