/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
/* Local Dependencies */
import {MintInfoService} from './mintinfo.service.js';
import {MintInfoInterceptor} from './mintinfo.interceptor.js';
import {
	OrchardMintInfo,
	OrchardMintInfoRpc,
	OrchardMintNameUpdate,
	OrchardMintIconUpdate,
	OrchardMintDescriptionUpdate,
	OrchardMintMotdUpdate,
	OrchardMintUrlUpdate,
	OrchardMintContactUpdate,
} from './mintinfo.model.js';

@Resolver()
export class MintInfoResolver {
	private readonly logger = new Logger(MintInfoResolver.name);

	constructor(private mintInfoService: MintInfoService) {}

	@Query(() => OrchardMintInfo, {description: 'Get mint info'})
	async mint_info(): Promise<OrchardMintInfo> {
		const tag = 'GET { mint_info }';
		this.logger.debug(tag);
		return await this.mintInfoService.getMintInfo(tag);
	}

	@Query(() => OrchardMintInfoRpc, {description: 'Get mint info from RPC'})
	async mint_info_rpc(): Promise<OrchardMintInfoRpc> {
		const tag = 'GET { mint_info_rpc }';
		this.logger.debug(tag);
		return await this.mintInfoService.getMintInfoRpc(tag);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'name',
		arg_keys: ['name'],
		old_value_key: 'name',
	})
	@Mutation(() => OrchardMintNameUpdate, {description: 'Update mint name'})
	async mint_name_update(@Args('name', {nullable: true, description: 'New mint name'}) name: string): Promise<OrchardMintNameUpdate> {
		const tag = 'MUTATION { mint_name_update }';
		this.logger.debug(tag);
		return await this.mintInfoService.updateMintName(tag, name);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'icon_url',
		arg_keys: ['icon_url'],
		old_value_key: 'icon_url',
	})
	@Mutation(() => OrchardMintIconUpdate, {description: 'Update mint icon URL'})
	async mint_icon_update(@Args('icon_url', {description: 'New icon URL'}) icon_url: string): Promise<OrchardMintIconUpdate> {
		const tag = 'MUTATION { mint_icon_update }';
		this.logger.debug(tag);
		return await this.mintInfoService.updateMintIcon(tag, icon_url);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'description',
		arg_keys: ['description'],
		old_value_key: 'description',
	})
	@Mutation(() => OrchardMintDescriptionUpdate, {description: 'Update mint short description'})
	async mint_short_description_update(
		@Args('description', {description: 'New short description'}) description: string,
	): Promise<OrchardMintDescriptionUpdate> {
		const tag = 'MUTATION { mint_short_description_update }';
		this.logger.debug(tag);
		return await this.mintInfoService.updateMintShortDescription(tag, description);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'description_long',
		arg_keys: ['description'],
		old_value_key: 'description_long',
	})
	@Mutation(() => OrchardMintDescriptionUpdate, {description: 'Update mint long description'})
	async mint_long_description_update(
		@Args('description', {description: 'New long description'}) description: string,
	): Promise<OrchardMintDescriptionUpdate> {
		const tag = 'MUTATION { mint_long_description_update }';
		this.logger.debug(tag);
		return await this.mintInfoService.updateMintLongDescription(tag, description);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'motd',
		arg_keys: ['motd'],
		old_value_key: 'motd',
	})
	@Mutation(() => OrchardMintMotdUpdate, {description: 'Update mint message of the day'})
	async mint_motd_update(
		@Args('motd', {nullable: true, description: 'New message of the day'}) motd: string,
	): Promise<OrchardMintMotdUpdate> {
		const tag = 'MUTATION { mint_motd_update }';
		this.logger.debug(tag);
		return await this.mintInfoService.updateMintMotd(tag, motd);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.CREATE,
		field: 'url',
		arg_keys: ['url'],
	})
	@Mutation(() => OrchardMintUrlUpdate, {description: 'Add a mint URL'})
	async mint_url_add(@Args('url', {description: 'URL to add'}) url: string): Promise<OrchardMintUrlUpdate> {
		const tag = 'MUTATION { mint_url_add }';
		this.logger.debug(tag);
		return await this.mintInfoService.addMintUrl(tag, url);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.DELETE,
		field: 'url',
		arg_keys: ['url'],
	})
	@Mutation(() => OrchardMintUrlUpdate, {description: 'Remove a mint URL'})
	async mint_url_remove(@Args('url', {description: 'URL to remove'}) url: string): Promise<OrchardMintUrlUpdate> {
		const tag = 'MUTATION { mint_url_remove }';
		this.logger.debug(tag);
		return await this.mintInfoService.removeMintUrl(tag, url);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.CREATE,
		field: 'contact',
		arg_keys: ['method', 'info'],
	})
	@Mutation(() => OrchardMintContactUpdate, {description: 'Add a mint contact method'})
	async mint_contact_add(
		@Args('method', {description: 'Contact method type'}) method: string,
		@Args('info', {description: 'Contact information'}) info: string,
	): Promise<OrchardMintContactUpdate> {
		const tag = 'MUTATION { mint_contact_add }';
		this.logger.debug(tag);
		return await this.mintInfoService.addMintContact(tag, method, info);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintInfoInterceptor)
	@LogEvent({
		type: EventLogType.DELETE,
		field: 'contact',
		arg_keys: ['method', 'info'],
	})
	@Mutation(() => OrchardMintContactUpdate, {description: 'Remove a mint contact method'})
	async mint_contact_remove(
		@Args('method', {description: 'Contact method type'}) method: string,
		@Args('info', {description: 'Contact information'}) info: string,
	): Promise<OrchardMintContactUpdate> {
		const tag = 'MUTATION { mint_contact_remove }';
		this.logger.debug(tag);
		return await this.mintInfoService.removeMintContact(tag, method, info);
	}
}
