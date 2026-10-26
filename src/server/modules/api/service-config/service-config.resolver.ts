/* Core Dependencies */
import {Args, Context, Mutation, Query, Resolver} from '@nestjs/graphql';
import {Logger} from '@nestjs/common';

/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {EventLogService} from '#server/modules/event/event.service';
import {EventLogSection, EventLogEntityType, EventLogType, EventLogStatus, EventLogDetailStatus} from '#server/modules/event/event.enums';
import {eventTimestamp, getActorType} from '#server/modules/event/event.helpers';
import type {ServiceName} from '#server/modules/service-config/types/service-config.types';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {ServiceConfigService} from '#server/modules/service-config/service-config.service';

/* Local Dependencies */
import {
	OrchardServiceStatus,
	OrchardServiceConfiguration,
	OrchardConnectionCheck,
	ServiceConnectionInput,
	ServiceKind,
} from './service-config.model.js';

@Resolver()
export class ServiceConfigResolver {
	private readonly logger = new Logger(ServiceConfigResolver.name);

	constructor(
		private serviceConfigService: ServiceConfigService,
		private errorService: ErrorService,
		private eventLogService: EventLogService,
	) {}

	/** Authenticated navigation flags contain no connection settings or credentials. */
	@Query(() => [OrchardServiceStatus])
	service_status(): Promise<OrchardServiceStatus[]> {
		return this.call('service_status', () => this.serviceConfigService.getStatus());
	}

	/** Read administrator-only connection fields. */
	@Roles(UserRole.ADMIN)
	@Query(() => [OrchardServiceConfiguration])
	service_configurations(): Promise<OrchardServiceConfiguration[]> {
		return this.call('service_configurations', () => this.serviceConfigService.getConfigurations());
	}

	/** Check submitted values without changing active connections. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardConnectionCheck)
	service_connection_test(@Args('input') input: ServiceConnectionInput): Promise<OrchardConnectionCheck> {
		return this.call('service_connection_test', () => this.serviceConfigService.test(input));
	}

	/** Test and apply an administrator's connection settings. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardConnectionCheck)
	service_configuration_save(
		@Args('input') input: ServiceConnectionInput,
		@Args('save_unreachable', {defaultValue: false}) save_unreachable: boolean,
		@Context('req') request: {user?: {id: string; role?: string}},
	): Promise<OrchardConnectionCheck> {
		return this.call('service_configuration_save', async () => {
			const result = await this.serviceConfigService.save(input, save_unreachable);
			if (result.saved) this.logConnectionEvent(input.service, EventLogType.UPDATE, request.user);
			return result;
		});
	}

	/** Disconnect Orchard and persist suppression of any environment configuration. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => Boolean)
	service_configuration_remove(
		@Args('service', {type: () => ServiceKind}) service: ServiceKind,
		@Context('req') request: {user?: {id: string; role?: string}},
	): Promise<boolean> {
		return this.call('service_configuration_remove', async () => {
			const removed = await this.serviceConfigService.remove(service);
			if (removed) this.logConnectionEvent(service, EventLogType.DELETE, request.user);
			return removed;
		});
	}

	/** Record the service, resulting settings source and actor without connection values or credentials. */
	private logConnectionEvent(service: ServiceName, type: EventLogType, user: {id: string; role?: string} | undefined): void {
		this.eventLogService.logEvent({
			actor_type: getActorType(user),
			actor_id: user?.id ?? 'unknown',
			timestamp: eventTimestamp(),
			section: EventLogSection.SETTINGS,
			entity_type: EventLogEntityType.SETTING,
			entity_id: `service.${service}`,
			type,
			status: EventLogStatus.SUCCESS,
			details: [
				{field: 'source', new_value: type === EventLogType.DELETE ? 'none' : 'orchard', status: EventLogDetailStatus.SUCCESS},
			],
		});
	}

	/** Preserve useful diagnostics while assigning an Orchard error code to resolver failures. */
	private async call<T>(tag: string, action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			const resolved = this.errorService.resolveError(this.logger, error, tag, {errord: OrchardErrorCode.SettingError});
			throw new OrchardApiError({...resolved, details: resolved.details ?? (error instanceof Error ? error.message : undefined)});
		}
	}
}
