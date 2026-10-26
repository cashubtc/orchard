/* Core Dependencies */
import {Field, InputType, Int} from '@nestjs/graphql';

@InputType()
export class FederationSetupKeysetInput {
	@Field(() => String, {description: 'Currency unit the keyset signs, e.g. "sat".'})
	unit: string;

	@Field(() => [String], {description: 'Token denominations the keyset can sign, e.g. [1, 2, 4, 8].'})
	amounts: string[];

	@Field(() => String, {description: 'Input fee charged per input, in parts per thousand.'})
	input_fee_ppk: string;

	@Field(() => String, {
		nullable: true,
		description: 'Absolute expiry as seconds since the UNIX epoch. Absent for a keyset that never expires.',
	})
	final_expiry?: string;
}

@InputType()
export class FederationSetupCreateInput {
	@Field(() => Int, {description: 'Number of federation members, including this one.'})
	members: number;

	@Field(() => Int, {description: 'Number of members whose signatures are needed to sign.'})
	threshold: number;

	@Field(() => String, {description: 'Bitcoin network: "bitcoin", "testnet", "signet", or "regtest".'})
	network: string;

	@Field(() => Int, {
		nullable: true,
		description: 'Number of members that must observe a payment before it counts. Defaults to the consensus threshold when absent.',
	})
	payment_observation_threshold?: number;

	@Field(() => String, {
		nullable: true,
		description: 'How long invitations stay valid, in seconds, from 300 to 604800. Defaults to one day when absent.',
	})
	invitation_lifetime_secs?: string;

	@Field(() => FederationSetupKeysetInput, {
		nullable: true,
		description: 'Initial keyset. When absent, the server uses a "sat" keyset with amounts 1 to 128 in powers of two and no input fee.',
	})
	keyset?: FederationSetupKeysetInput;

	@Field(() => String, {nullable: true, description: "Wallet-facing URL of this mint. Defaults to the daemon's configured mint URL."})
	public_mint_url?: string;

	@Field(() => String, {
		nullable: true,
		description:
			"URL other members use to reach this member's federation API. Must differ from the public mint URL unless both are the same Iroh endpoint; defaults to the public mint URL only for Iroh members.",
	})
	federation_api_url?: string;

	@Field(() => String, {
		nullable: true,
		description: 'URL joining members use to reach this coordinator. Defaults to the federation API URL.',
	})
	coordinator_url?: string;

	@Field(() => Boolean, {nullable: true, description: 'Allows plain-HTTP localhost URLs, for local testing only.'})
	allow_insecure_localhost?: boolean;
}

@InputType()
export class FederationSetupJoinInput {
	@Field(() => String, {description: 'Invitation issued by the coordinator for this member.'})
	invitation: string;

	@Field(() => String, {nullable: true, description: "Wallet-facing URL of this mint. Defaults to the daemon's configured mint URL."})
	public_mint_url?: string;

	@Field(() => String, {
		nullable: true,
		description:
			"URL other members use to reach this member's federation API. Must differ from the public mint URL unless both are the same Iroh endpoint; defaults to the public mint URL only for Iroh members.",
	})
	federation_api_url?: string;

	@Field(() => Boolean, {nullable: true, description: 'Allows plain-HTTP localhost URLs, for local testing only.'})
	allow_insecure_localhost?: boolean;
}
