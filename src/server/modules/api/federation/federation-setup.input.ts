/* Core Dependencies */
import {Field, InputType, Int} from '@nestjs/graphql';

@InputType()
export class FederationSetupKeysetInput {
	@Field(() => String)
	unit: string;

	@Field(() => [String])
	amounts: string[];

	@Field(() => String)
	input_fee_ppk: string;

	@Field(() => String, {nullable: true})
	final_expiry?: string;
}

@InputType()
export class FederationSetupCreateInput {
	@Field(() => Int)
	members: number;

	@Field(() => Int)
	threshold: number;

	@Field(() => String)
	network: string;

	@Field(() => Int, {nullable: true})
	payment_observation_threshold?: number;

	@Field(() => FederationSetupKeysetInput, {nullable: true})
	keyset?: FederationSetupKeysetInput;

	@Field(() => String, {nullable: true})
	public_mint_url?: string;

	@Field(() => String, {nullable: true})
	federation_api_url?: string;

	@Field(() => String, {nullable: true})
	coordinator_url?: string;

	@Field(() => Boolean, {nullable: true})
	allow_insecure_localhost?: boolean;
}

@InputType()
export class FederationSetupJoinInput {
	@Field(() => String)
	invitation: string;

	@Field(() => String, {nullable: true})
	public_mint_url?: string;

	@Field(() => String, {nullable: true})
	federation_api_url?: string;

	@Field(() => Boolean, {nullable: true})
	allow_insecure_localhost?: boolean;
}
