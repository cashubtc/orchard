/* Core Dependencies */
import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';
/* Application Dependencies */
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
	constructor(private serviceConfigService: ServiceConfigService) {}

	/** Authenticated navigation flags contain no connection settings or credentials. */
	@Query(() => [OrchardServiceStatus])
	service_status(): Promise<OrchardServiceStatus[]> {
		return this.serviceConfigService.getStatus();
	}

	/** Read administrator-only connection fields. */
	@Roles(UserRole.ADMIN)
	@Query(() => [OrchardServiceConfiguration])
	service_configurations(): Promise<OrchardServiceConfiguration[]> {
		return this.serviceConfigService.getConfigurations();
	}

	/** Check submitted values without changing active connections. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardConnectionCheck)
	service_connection_test(@Args('input') input: ServiceConnectionInput): Promise<OrchardConnectionCheck> {
		return this.serviceConfigService.test(input);
	}

	/** Test and apply an administrator's connection settings. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardConnectionCheck)
	service_configuration_save(
		@Args('input') input: ServiceConnectionInput,
		@Args('save_unreachable', {defaultValue: false}) save_unreachable: boolean,
	): Promise<OrchardConnectionCheck> {
		return this.serviceConfigService.save(input, save_unreachable);
	}

	/** Disconnect Orchard and persist suppression of any environment configuration. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => Boolean)
	service_configuration_remove(@Args('service', {type: () => ServiceKind}) service: ServiceKind): Promise<boolean> {
		return this.serviceConfigService.remove(service);
	}
}
