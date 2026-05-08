/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {OrchardMintWatchdogStatus} from './mintwatchdog.model';
import {MintWatchdogService} from './mintwatchdog.service';

@Resolver()
export class MintWatchdogResolver {
	private readonly logger = new Logger(MintWatchdogResolver.name);

	constructor(private mintWatchdogService: MintWatchdogService) {}

	@Query(() => OrchardMintWatchdogStatus, {
		description: 'Liveness of the nutshell balance_log watchdog. Throws on backends without a watchdog (e.g. cdk).',
	})
	async mint_watchdog_status(): Promise<OrchardMintWatchdogStatus> {
		const tag = 'GET { mint_watchdog_status }';
		this.logger.debug(tag);
		return this.mintWatchdogService.getWatchdogStatus(tag);
	}
}
