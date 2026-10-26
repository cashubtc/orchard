/* Core Dependencies */
import {Field, ObjectType, InputType, Int, registerEnumType} from '@nestjs/graphql';

/* Application Dependencies */
import type {ServiceName} from '#server/modules/service-config/types/service-config.types';

export enum ServiceKind {
	bitcoin = 'bitcoin',
	lightning = 'lightning',
	mint = 'mint',
}
registerEnumType(ServiceKind, {name: 'ServiceKind'});

@ObjectType()
export class OrchardServiceStatus {
	@Field(() => ServiceKind)
	service: ServiceName;
	@Field(() => Boolean)
	enabled: boolean;
	@Field(() => String, {nullable: true})
	type: string | null;
	@Field(() => String)
	source: string;
	@Field(() => String)
	status: string;
	@Field(() => Boolean)
	public_api: boolean;
	@Field(() => Boolean)
	database: boolean;
	@Field(() => String)
	database_type: string;
	@Field(() => Boolean)
	metrics: boolean;
}

@ObjectType()
export class OrchardServiceField {
	@Field(() => String)
	key: string;
	@Field(() => String, {nullable: true})
	value: string | null;
	@Field(() => Boolean)
	secret: boolean;
	@Field(() => Boolean)
	set: boolean;
}

@ObjectType()
export class OrchardConnectionCheck {
	@Field(() => Boolean)
	ok: boolean;
	@Field(() => Boolean)
	warning: boolean;
	@Field(() => Boolean, {description: 'Whether this request stored and applied the connection'})
	saved: boolean;
	@Field(() => String)
	title: string;
	@Field(() => String)
	context: string;
	@Field(() => String, {nullable: true})
	diagnostic: string | null;
	@Field(() => [String])
	fields: string[];
	@Field(() => String, {nullable: true})
	chain: string | null;
	@Field(() => Boolean, {nullable: true})
	chain_match: boolean | null;
	@Field(() => String, {nullable: true})
	mode: string | null;
	@Field(() => String, {nullable: true, description: 'Bitcoin Core version returned by the node'})
	bitcoin_version: string | null;
	@Field(() => Int, {nullable: true, description: 'Current Bitcoin block height'})
	bitcoin_blocks: number | null;
	@Field(() => Int, {nullable: true, description: 'Local federation member identifier'})
	mint_member_id: number | null;
	@Field(() => Int, {nullable: true, description: 'Number of members in the federation'})
	mint_member_count: number | null;
}

@ObjectType()
export class OrchardServiceConfiguration extends OrchardServiceStatus {
	@Field(() => [OrchardServiceField])
	fields: OrchardServiceField[];
}

@InputType()
export class ServiceFieldInput {
	@Field(() => String)
	key: string;
	@Field(() => String)
	value: string;
}

@InputType()
export class ServiceConnectionInput {
	@Field(() => ServiceKind)
	service: ServiceName;
	@Field(() => [ServiceFieldInput])
	values: ServiceFieldInput[];
}
