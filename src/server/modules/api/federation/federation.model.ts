/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';

/* Application Dependencies */
import type {FederationMode, FederationModeResult} from '#server/modules/federation/federation.types';

@ObjectType({description: 'Mode of the configured mint daemon'})
export class OrchardFederationMode implements FederationModeResult {
	@Field(() => String, {description: 'setup, member, standalone, or unreachable'})
	mode: FederationMode;

	@Field(() => String, {nullable: true, description: 'Exact upstream connection diagnostic, when unreachable'})
	details: string | null;
}
