/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';

@ObjectType()
export class OrchardFederationSetupKeyset {
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

@ObjectType()
export class OrchardFederationSetupInvitation {
	@Field(() => Int, {description: 'Member slot the invitation is for.'})
	member_id: number;

	@Field(() => String, {
		description: 'Encoded invitation to pass to JoinSetup on that member. Treat it as a secret until the member has joined.',
	})
	invitation: string;

	@Field(() => String, {description: 'When the invitation stops working, as seconds since the UNIX epoch.'})
	expires_at_unix: string;
}

@ObjectType()
export class OrchardFederationSetupCreated {
	@Field(() => String, {description: 'Identifier of the new setup.'})
	setup_id: string;

	@Field(() => Int, {description: 'Member slot of this daemon.'})
	member_id: number;

	@Field(() => [OrchardFederationSetupInvitation], {description: 'One invitation per joining member, ordered by member_id.'})
	invitations: OrchardFederationSetupInvitation[];
}

@ObjectType()
export class OrchardFederationSetupJoined {
	@Field(() => String, {description: 'Identifier of the joined setup.'})
	setup_id: string;

	@Field(() => Int, {description: 'Member slot assigned to this daemon.'})
	member_id: number;
}

@ObjectType()
export class OrchardFederationSetupProposalHash {
	@Field(() => String, {description: 'Hash of the new proposal that members approve.'})
	proposal_hash: string;
}

@ObjectType()
export class OrchardFederationSetupMember {
	@Field(() => Int, {description: 'Member slot.'})
	member_id: number;

	@Field(() => String, {description: "Wallet-facing URL of the member's mint."})
	public_mint_url: string;

	@Field(() => String, {description: "URL other members use to reach the member's federation API."})
	federation_api_url: string;

	@Field(() => String, {
		description:
			"First 16 lowercase hex characters of the SHA-256 fingerprint of the member's identity key. Compare it with the member out of band.",
	})
	identity_fingerprint: string;
}

@ObjectType()
export class OrchardFederationSetupReview {
	@Field(() => String, {description: 'Identifier of the setup being reviewed.'})
	setup_id: string;

	@Field(() => String, {description: 'Federation identifier the proposal produces.'})
	proposed_federation_id: string;

	@Field(() => String, {description: 'Hash to pass to ApproveProposal.'})
	proposal_hash: string;

	@Field(() => String, {description: 'Bitcoin network committed by the proposal.'})
	network: string;

	@Field(() => Int, {description: 'Number of federation members.'})
	member_count: number;

	@Field(() => Int, {description: 'Number of members whose signatures are needed to sign.'})
	signature_threshold: number;

	@Field(() => Int, {description: 'Number of members needed to reach consensus.'})
	consensus_threshold: number;

	@Field(() => [OrchardFederationSetupMember], {description: 'Members, ordered by member_id.'})
	members: OrchardFederationSetupMember[];

	@Field(() => [OrchardFederationSetupKeyset], {description: 'Initial keysets the federation generates.'})
	keysets: OrchardFederationSetupKeyset[];

	@Field(() => String, {description: 'The complete review as JSON, including the fields not typed above.'})
	details_json: string;
}

@ObjectType()
export class OrchardFederationSetupDkg {
	@Field(() => String, {
		nullable: true,
		description: 'Key generation phase. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	phase?: string | null;

	@Field(() => String, {description: 'Number of member participant states recorded.'})
	participant_states: string;

	@Field(() => String, {description: 'Number of commitments recorded.'})
	commitments: string;

	@Field(() => String, {description: 'Number of reveals recorded.'})
	reveals: string;

	@Field(() => String, {description: 'Number of secret share contributions recorded.'})
	secret_share_contributions: string;

	@Field(() => String, {description: 'Number of keyset shares recorded.'})
	keyset_shares: string;

	@Field(() => String, {description: 'Number of transcript signatures recorded.'})
	transcript_signatures: string;

	@Field(() => String, {description: 'Number of final config confirmations recorded.'})
	final_config_confirmations: string;

	@Field(() => String, {description: 'Number of FROST root public configs recorded.'})
	frost_root_public_configs: string;

	@Field(() => [Int], {description: 'Members that have confirmed the result, ordered by member_id.'})
	confirmed_members: number[];

	@Field(() => Boolean, {description: 'Whether the final config is ready and ActivateSetup can run.'})
	finalized_ready: boolean;

	@Field(() => String, {nullable: true, description: 'Digest of the key generation confirmation, once known.'})
	dkg_confirmation_digest?: string;

	@Field(() => String, {nullable: true, description: 'Digest of the final federation config, once known.'})
	final_config_digest?: string;

	@Field(() => String, {nullable: true, description: 'Hash of the key generation transcript, once known.'})
	transcript_hash?: string;

	@Field(() => String, {nullable: true, description: 'Last key generation error, when one occurred.'})
	error?: string;
}

@ObjectType()
export class OrchardFederationSetupActivation {
	@Field(() => String, {description: 'Identifier of the activated setup.'})
	setup_id: string;

	@Field(() => Int, {description: 'Member slot of this daemon.'})
	member_id: number;

	@Field(() => String, {description: 'Hash of the certified manifest that authorized key generation.'})
	manifest_hash: string;

	@Field(() => String, {description: 'Identifier of the federation.'})
	federation_id: string;

	@Field(() => String, {description: 'Digest of the final federation config.'})
	final_config_digest: string;

	@Field(() => String, {description: 'Activation time as seconds since the UNIX epoch.'})
	activated_at_unix: string;
}

@ObjectType()
export class OrchardFederationSetupStatus {
	@Field(() => Boolean, {
		description: 'Whether a setup exists. False before CreateSetup or JoinSetup, in which case every other field is empty.',
	})
	initialized: boolean;

	@Field(() => String, {nullable: true, description: 'Identifier of the setup.'})
	setup_id?: string;

	@Field(() => Int, {nullable: true, description: 'Member slot of this daemon.'})
	member_id?: number;

	@Field(() => String, {
		nullable: true,
		description:
			'Role of this daemon. Unspecified when not initialized. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	role?: string | null;

	@Field(() => String, {
		nullable: true,
		description:
			'Phase of this daemon as a setup participant. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	participant_phase?: string | null;

	@Field(() => String, {
		nullable: true,
		description:
			'Phase of the coordinator, when this daemon is the coordinator. Null when unspecified; unknown numeric values are labeled for newer CDK versions.',
	})
	coordinator_phase?: string | null;

	@Field(() => Int, {description: 'Number of federation members.'})
	member_count: number;

	@Field(() => [Int], {description: 'Members that have enrolled, ordered by member_id.'})
	enrolled_members: number[];

	@Field(() => [Int], {description: 'Members that have not enrolled yet, ordered by member_id.'})
	missing_enrollments: number[];

	@Field(() => [Int], {description: 'Members that have approved the proposal, ordered by member_id.'})
	approved_members: number[];

	@Field(() => [Int], {description: 'Members that have not approved the proposal yet, ordered by member_id.'})
	missing_approvals: number[];

	@Field(() => String, {nullable: true, description: 'Hash of the current proposal, once proposed.'})
	proposal_hash?: string;

	@Field(() => String, {nullable: true, description: 'Hash of the certified manifest, once every member has approved.'})
	manifest_hash?: string;

	@Field(() => OrchardFederationSetupDkg, {nullable: true, description: 'Key generation progress, once key generation has started.'})
	dkg?: OrchardFederationSetupDkg;

	@Field(() => OrchardFederationSetupActivation, {nullable: true, description: 'Activation record, once this daemon has activated.'})
	activation?: OrchardFederationSetupActivation;

	@Field(() => String, {
		nullable: true,
		description:
			"First 16 lowercase hex characters of the SHA-256 fingerprint of this member's identity key. Share it with the other operators so they can match it against this member in ReviewProposal.",
	})
	identity_fingerprint?: string;
}

@ObjectType()
export class OrchardFederationSetupActivated {
	@Field(() => String, {description: 'Identifier of the activated setup.'})
	setup_id: string;

	@Field(() => Int, {description: 'Member slot of this daemon.'})
	member_id: number;

	@Field(() => String, {description: 'Identifier of the federation.'})
	federation_id: string;

	@Field(() => String, {description: 'Digest of the final federation config.'})
	final_config_digest: string;

	@Field(() => String, {description: 'Reminder for the operator to back up the federation config and keys.'})
	backup_warning: string;

	@Field(() => Boolean, {description: 'Whether the daemon will restart as a federation member after this response.'})
	restart_pending: boolean;
}

@ObjectType()
export class OrchardFederationSetupInvitationReplaced {
	@Field(() => OrchardFederationSetupInvitation, {nullable: true, description: 'The new invitation for that member.'})
	invitation?: OrchardFederationSetupInvitation;
}

@ObjectType()
export class OrchardFederationSetupAborted {
	@Field(() => String, {description: 'Identifier of the aborted setup.'})
	setup_id: string;
}
