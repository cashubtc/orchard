/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {OrchardSystemInfo} from './sysinfo.model';
import {ApiSystemInfoService} from './sysinfo.service';

@Resolver()
export class SystemInfoResolver {
	private readonly logger = new Logger(SystemInfoResolver.name);

	constructor(private apiSystemInfoService: ApiSystemInfoService) {}

	@Query(() => OrchardSystemInfo, {description: 'Get live host system information'})
	async system_info(): Promise<OrchardSystemInfo> {
		const tag = 'GET { system_info }';
		this.logger.debug(tag);
		return await this.apiSystemInfoService.getSystemInfo(tag);
	}
}
