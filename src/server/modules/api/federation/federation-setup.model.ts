/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';

@ObjectType()
export class OrchardFederationSetupKeyset {
	@Field(() => String)
	unit: string;

	@Field(() => [String])
	amounts: string[];

	@Field(() => String)
	input_fee_ppk: string;

	@Field(() => String, {nullable: true})
	final_expiry?: string;
}

@ObjectType()
export class OrchardFederationSetupInvitation {
	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	invitation: string;

	@Field(() => String)
	expires_at_unix: string;
}

@ObjectType()
export class OrchardFederationSetupCreated {
	@Field(() => String)
	setup_id: string;

	@Field(() => Int)
	member_id: number;

	@Field(() => [OrchardFederationSetupInvitation])
	invitations: OrchardFederationSetupInvitation[];
}

@ObjectType()
export class OrchardFederationSetupJoined {
	@Field(() => String)
	setup_id: string;

	@Field(() => Int)
	member_id: number;
}

@ObjectType()
export class OrchardFederationSetupProposalHash {
	@Field(() => String)
	proposal_hash: string;
}

@ObjectType()
export class OrchardFederationSetupMember {
	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	public_mint_url: string;

	@Field(() => String)
	federation_api_url: string;

	@Field(() => String)
	identity_fingerprint: string;
}

@ObjectType()
export class OrchardFederationSetupReview {
	@Field(() => String)
	setup_id: string;

	@Field(() => String)
	proposed_federation_id: string;

	@Field(() => String)
	proposal_hash: string;

	@Field(() => String)
	network: string;

	@Field(() => Int)
	member_count: number;

	@Field(() => Int)
	signature_threshold: number;

	@Field(() => Int)
	consensus_threshold: number;

	@Field(() => [OrchardFederationSetupMember])
	members: OrchardFederationSetupMember[];

	@Field(() => [OrchardFederationSetupKeyset])
	keysets: OrchardFederationSetupKeyset[];

	@Field(() => String)
	details_json: string;
}

@ObjectType()
export class OrchardFederationSetupDkg {
	@Field(() => String, {nullable: true})
	phase?: string;

	@Field(() => String)
	participant_states: string;

	@Field(() => String)
	commitments: string;

	@Field(() => String)
	reveals: string;

	@Field(() => String)
	secret_share_contributions: string;

	@Field(() => String)
	keyset_shares: string;

	@Field(() => String)
	transcript_signatures: string;

	@Field(() => String)
	final_config_confirmations: string;

	@Field(() => String)
	frost_root_public_configs: string;

	@Field(() => [Int])
	confirmed_members: number[];

	@Field(() => Boolean)
	finalized_ready: boolean;

	@Field(() => String, {nullable: true})
	dkg_confirmation_digest?: string;

	@Field(() => String, {nullable: true})
	final_config_digest?: string;

	@Field(() => String, {nullable: true})
	transcript_hash?: string;

	@Field(() => String, {nullable: true})
	error?: string;
}

@ObjectType()
export class OrchardFederationSetupActivation {
	@Field(() => String)
	setup_id: string;

	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	manifest_hash: string;

	@Field(() => String)
	federation_id: string;

	@Field(() => String)
	final_config_digest: string;

	@Field(() => String)
	activated_at_unix: string;
}

@ObjectType()
export class OrchardFederationSetupStatus {
	@Field(() => Boolean)
	initialized: boolean;

	@Field(() => String, {nullable: true})
	setup_id?: string;

	@Field(() => Int, {nullable: true})
	member_id?: number;

	@Field(() => String, {nullable: true})
	role?: string;

	@Field(() => String, {nullable: true})
	participant_phase?: string;

	@Field(() => String, {nullable: true})
	coordinator_phase?: string;

	@Field(() => Int)
	member_count: number;

	@Field(() => [Int])
	enrolled_members: number[];

	@Field(() => [Int])
	missing_enrollments: number[];

	@Field(() => [Int])
	approved_members: number[];

	@Field(() => [Int])
	missing_approvals: number[];

	@Field(() => String, {nullable: true})
	proposal_hash?: string;

	@Field(() => String, {nullable: true})
	manifest_hash?: string;

	@Field(() => OrchardFederationSetupDkg, {nullable: true})
	dkg?: OrchardFederationSetupDkg;

	@Field(() => OrchardFederationSetupActivation, {nullable: true})
	activation?: OrchardFederationSetupActivation;

	@Field(() => String, {nullable: true})
	identity_fingerprint?: string;
}

@ObjectType()
export class OrchardFederationSetupActivated {
	@Field(() => String)
	setup_id: string;

	@Field(() => Int)
	member_id: number;

	@Field(() => String)
	federation_id: string;

	@Field(() => String)
	final_config_digest: string;

	@Field(() => String)
	backup_warning: string;

	@Field(() => Boolean)
	restart_pending: boolean;
}

@ObjectType()
export class OrchardFederationSetupInvitationReplaced {
	@Field(() => OrchardFederationSetupInvitation, {nullable: true})
	invitation?: OrchardFederationSetupInvitation;
}

@ObjectType()
export class OrchardFederationSetupAborted {
	@Field(() => String)
	setup_id: string;
}
