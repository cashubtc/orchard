/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {
	CashuCachedEndpoint,
	CashuContact,
	CashuMintInfo,
	CashuNut4Method,
	CashuNut5Method,
	CashuNut15Method,
	CashuNutSupported,
	CashuProtectedEndpoint,
} from '#server/modules/cashu/mintapi/cashumintapi.types';
import type {CashuMintInfoRpc} from '#server/modules/cashu/mintrpc/cashumintrpc.types';
import {MintUnit} from '#server/modules/cashu/cashu.enums';

@ObjectType({description: 'NUT support status'})
export class OrchardNutSupported {
	@Field({description: 'Whether the NUT is supported'})
	supported: boolean;

	constructor(
		nut:
			| CashuMintInfo['nuts']['7']
			| CashuMintInfo['nuts']['8']
			| CashuMintInfo['nuts']['9']
			| CashuMintInfo['nuts']['10']
			| CashuMintInfo['nuts']['11']
			| CashuMintInfo['nuts']['12']
			| CashuMintInfo['nuts']['14'],
	) {
		this.supported = nut.supported;
	}
}

@ObjectType({description: 'NUT-04 minting configuration'})
export class OrchardNut4 {
	@Field(() => [OrchardNut4Method], {description: 'Supported minting methods'})
	methods: OrchardNut4Method[];

	@Field({description: 'Whether minting is disabled'})
	disabled: boolean;

	constructor(nut4: CashuMintInfo['nuts']['4']) {
		this.methods = Object.values(nut4.methods).map((method) => new OrchardNut4Method(method));
		this.disabled = nut4.disabled;
	}
}

@ObjectType({description: 'NUT-05 melting configuration'})
export class OrchardNut5 {
	@Field(() => [OrchardNut5Method], {description: 'Supported melting methods'})
	methods: OrchardNut5Method[];

	@Field({description: 'Whether melting is disabled'})
	disabled: boolean;

	constructor(nut5: CashuMintInfo['nuts']['5']) {
		this.methods = Object.values(nut5.methods).map((method) => new OrchardNut5Method(method));
		this.disabled = nut5.disabled;
	}
}

@ObjectType({description: 'NUT-15 multipath payment configuration'})
export class OrchardNut15 {
	@Field(() => [OrchardNut15Method], {description: 'Supported multipath payment methods'})
	methods: OrchardNut15Method[];

	constructor(nut15: CashuMintInfo['nuts']['15']) {
		this.methods = Object.values(nut15.methods).map((method) => new OrchardNut15Method(method));
	}
}

@ObjectType({description: 'NUT-17 WebSocket subscription configuration'})
export class OrchardNut17 {
	@Field(() => [OrchardNut17Supported], {description: 'Supported WebSocket subscription methods'})
	supported: OrchardNut17Supported[];

	constructor(nut17: CashuMintInfo['nuts']['17']) {
		this.supported = Object.values(nut17.supported).map((supported) => new OrchardNut17Supported(supported));
	}
}

@ObjectType({description: 'NUT-19 cached endpoint configuration'})
export class OrchardNut19 {
	@Field(() => [OrchardCachedEndpoint], {description: 'Cached endpoints'})
	cached_endpoints: OrchardCachedEndpoint[];

	@Field({description: 'Cache time-to-live in seconds'})
	ttl: number;

	constructor(nut19: CashuMintInfo['nuts']['19']) {
		this.cached_endpoints = Object.values(nut19.cached_endpoints).map((cached_endpoint) => new OrchardCachedEndpoint(cached_endpoint));
		this.ttl = nut19.ttl;
	}
}

@ObjectType({description: 'NUT-21 clear authentication configuration'})
export class OrchardNut21 {
	@Field({description: 'OpenID Connect discovery URL'})
	openid_discovery: string;

	@Field({description: 'OpenID Connect client ID'})
	client_id: string;

	@Field(() => [OrchardProtectedEndpoint], {description: 'Endpoints requiring clear authentication'})
	protected_endpoints: OrchardProtectedEndpoint[];

	constructor(nut21: CashuMintInfo['nuts']['21']) {
		this.openid_discovery = nut21.openid_discovery;
		this.client_id = nut21.client_id;
		this.protected_endpoints = nut21.protected_endpoints.map((endpoint) => new OrchardProtectedEndpoint(endpoint));
	}
}

@ObjectType({description: 'NUT-22 blind authentication configuration'})
export class OrchardNut22 {
	@Field({description: 'Maximum number of BATs that can be minted in a single request'})
	bat_max_mint: number;

	@Field(() => [OrchardProtectedEndpoint], {description: 'Endpoints requiring blind authentication'})
	protected_endpoints: OrchardProtectedEndpoint[];

	constructor(nut22: CashuMintInfo['nuts']['22']) {
		this.bat_max_mint = nut22.bat_max_mint;
		this.protected_endpoints = nut22.protected_endpoints.map((endpoint) => new OrchardProtectedEndpoint(endpoint));
	}
}

@ObjectType({description: 'NUT-29 batched minting configuration'})
export class OrchardNut29 {
	@Field({nullable: true, description: 'Maximum number of quotes allowed per batch'})
	max_batch_size?: number;

	@Field(() => [String], {nullable: true, description: 'Payment methods supported for batch minting'})
	methods?: string[];

	constructor(nut29: CashuMintInfo['nuts']['29']) {
		this.max_batch_size = nut29.max_batch_size;
		this.methods = nut29.methods;
	}
}

@ObjectType({description: 'Cashu NUT support matrix'})
export class OrchardNuts {
	@Field({description: 'NUT-04 minting configuration'})
	nut4: OrchardNut4;

	@Field({description: 'NUT-05 melting configuration'})
	nut5: OrchardNut5;

	@Field({nullable: true, description: 'NUT-07 token state check support'})
	nut7: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-08 lightning fee return support'})
	nut8: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-09 restore support'})
	nut9: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-10 spending conditions support'})
	nut10: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-11 pay-to-pubkey support'})
	nut11: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-12 DLEQ proofs support'})
	nut12: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-14 hashed timelock contracts support'})
	nut14: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-15 multipath payment configuration'})
	nut15: OrchardNut15;

	@Field({nullable: true, description: 'NUT-17 WebSocket subscription configuration'})
	nut17: OrchardNut17;

	@Field({nullable: true, description: 'NUT-19 cached endpoint configuration'})
	nut19: OrchardNut19;

	@Field({nullable: true, description: 'NUT-20 signature on mint quote support'})
	nut20: OrchardNutSupported;

	@Field({nullable: true, description: 'NUT-21 clear authentication configuration'})
	nut21: OrchardNut21;

	@Field({nullable: true, description: 'NUT-22 blind authentication configuration'})
	nut22: OrchardNut22;

	@Field({nullable: true, description: 'NUT-29 batched minting configuration'})
	nut29: OrchardNut29;

	constructor(nuts: CashuMintInfo['nuts']) {
		this.nut4 = new OrchardNut4(nuts['4']);
		this.nut5 = new OrchardNut5(nuts['5']);
		this.nut7 = nuts['7'] ? new OrchardNutSupported(nuts['7']) : null;
		this.nut8 = nuts['8'] ? new OrchardNutSupported(nuts['8']) : null;
		this.nut9 = nuts['9'] ? new OrchardNutSupported(nuts['9']) : null;
		this.nut10 = nuts['10'] ? new OrchardNutSupported(nuts['10']) : null;
		this.nut11 = nuts['11'] ? new OrchardNutSupported(nuts['11']) : null;
		this.nut12 = nuts['12'] ? new OrchardNutSupported(nuts['12']) : null;
		this.nut14 = nuts['14'] ? new OrchardNutSupported(nuts['14']) : null;
		this.nut15 = nuts['15'] ? new OrchardNut15(nuts['15']) : null;
		this.nut17 = nuts['17'] ? new OrchardNut17(nuts['17']) : null;
		this.nut19 = nuts['19'] ? new OrchardNut19(nuts['19']) : null;
		this.nut20 = nuts['20'] ? new OrchardNutSupported(nuts['20']) : null;
		this.nut21 = nuts['21'] ? new OrchardNut21(nuts['21']) : null;
		this.nut22 = nuts['22'] ? new OrchardNut22(nuts['22']) : null;
		this.nut29 = nuts['29'] ? new OrchardNut29(nuts['29']) : null;
	}
}

@ObjectType({description: 'Cashu mint information'})
export class OrchardMintInfo {
	@Field({nullable: true, description: 'Mint name'})
	name: string;

	@Field({nullable: true, description: 'Mint public key'})
	pubkey: string;

	@Field({description: 'Mint software version'})
	version: string;

	@Field({nullable: true, description: 'Short description of the mint'})
	description: string;

	@Field({nullable: true, description: 'Long description of the mint'})
	description_long: string;

	@Field(() => [OrchardContact], {nullable: true, description: 'Mint contact methods'})
	contact: OrchardContact[];

	@Field({nullable: true, description: 'Mint icon URL'})
	icon_url: string;

	@Field({nullable: true, description: 'Terms of service URL'})
	tos_url: string;

	@Field(() => [String], {nullable: true, description: 'Mint URLs'})
	urls: string[];

	@Field(() => UnixTimestamp, {nullable: true, description: 'Mint server timestamp'})
	time: number;

	@Field(() => OrchardNuts, {description: 'Supported NUTs and their configuration'})
	nuts: OrchardNuts;

	constructor(cashu_info: CashuMintInfo) {
		this.name = cashu_info.name;
		this.pubkey = cashu_info.pubkey;
		this.version = cashu_info.version;
		this.description = cashu_info.description;
		this.description_long = cashu_info.description_long;
		this.contact = cashu_info.contact;
		this.icon_url = cashu_info.icon_url;
		this.tos_url = cashu_info.tos_url;
		this.urls = cashu_info.urls;
		this.time = cashu_info.time;
		this.nuts = new OrchardNuts(cashu_info.nuts);
	}
}

@ObjectType({description: 'Mint contact information'})
export class OrchardContact {
	@Field({description: 'Contact method type'})
	method: string;

	@Field({description: 'Contact information value'})
	info: string;

	constructor(contact: CashuContact) {
		this.method = contact.method;
		this.info = contact.info;
	}
}

@ObjectType({description: 'NUT-04 method-specific minting options'})
export class OrchardNut4MethodOptions {
	@Field(() => Int, {nullable: true, description: 'Required block confirmations for onchain mint payments'})
	confirmations?: number;

	constructor(options: CashuNut4Method['options']) {
		this.confirmations = options?.confirmations;
	}
}

@ObjectType({description: 'NUT-04 minting method details'})
export class OrchardNut4Method {
	@Field(() => String, {description: 'Payment method identifier'})
	method: string;

	@Field({description: 'Currency unit'})
	unit: string;

	@Field({nullable: true, description: 'Whether descriptions are supported'})
	description?: boolean;

	@Field({nullable: true, description: 'Minimum minting amount'})
	min_amount?: number;

	@Field({nullable: true, description: 'Maximum minting amount'})
	max_amount?: number;

	@Field(() => OrchardNut4MethodOptions, {nullable: true, description: 'Method-specific minting options'})
	options?: OrchardNut4MethodOptions;

	constructor(method: CashuNut4Method) {
		this.method = method.method;
		this.unit = method.unit;
		this.description = method.description;
		this.min_amount = method.min_amount;
		this.max_amount = method.max_amount;
		this.options = method.options ? new OrchardNut4MethodOptions(method.options) : null;
	}
}

@ObjectType({description: 'NUT-05 melting method details'})
export class OrchardNut5Method {
	@Field(() => String, {description: 'Payment method identifier'})
	method: string;

	@Field({description: 'Currency unit'})
	unit: string;

	@Field({nullable: true, description: 'Whether amountless melting is supported'})
	amountless?: boolean;

	@Field({nullable: true, description: 'Minimum melting amount'})
	min_amount?: number;

	@Field({nullable: true, description: 'Maximum melting amount'})
	max_amount?: number;

	constructor(method: CashuNut5Method) {
		this.method = method.method;
		this.unit = method.unit;
		this.amountless = method.amountless;
		this.min_amount = method.min_amount;
		this.max_amount = method.max_amount;
	}
}

@ObjectType({description: 'NUT-15 multipath payment method details'})
export class OrchardNut15Method {
	@Field(() => String, {description: 'Payment method identifier'})
	method: string;

	@Field(() => MintUnit, {description: 'Currency unit'})
	unit: MintUnit;

	constructor(method: CashuNut15Method) {
		this.method = method.method;
		this.unit = method.unit;
	}
}

@ObjectType({description: 'NUT-17 WebSocket subscription method details'})
export class OrchardNut17Supported {
	@Field(() => String, {description: 'Payment method identifier'})
	method: string;

	@Field({description: 'Currency unit'})
	unit: string;

	@Field(() => [String], {description: 'Supported subscription commands'})
	commands: string[];

	constructor(supported: CashuNutSupported) {
		this.method = supported.method;
		this.unit = supported.unit;
		this.commands = supported.commands;
	}
}

@ObjectType({description: 'Cached endpoint entry'})
export class OrchardCachedEndpoint {
	@Field({description: 'HTTP method'})
	method: string;

	@Field({description: 'Endpoint path'})
	path: string;

	constructor(cached_endpoint: CashuCachedEndpoint) {
		this.method = cached_endpoint.method;
		this.path = cached_endpoint.path;
	}
}

@ObjectType({description: 'Protected endpoint requiring authentication'})
export class OrchardProtectedEndpoint {
	@Field({description: 'HTTP method'})
	method: string;

	@Field({description: 'Endpoint path (may end with * wildcard)'})
	path: string;

	constructor(protected_endpoint: CashuProtectedEndpoint) {
		this.method = protected_endpoint.method;
		this.path = protected_endpoint.path;
	}
}

@ObjectType({description: 'Cashu mint RPC information'})
export class OrchardMintInfoRpc {
	@Field({nullable: true, description: 'Mint name'})
	name: string;

	@Field({description: 'Mint software version'})
	version: string;

	@Field({nullable: true, description: 'Short description of the mint'})
	description: string;

	@Field({nullable: true, description: 'Message of the day'})
	motd: string;

	@Field({nullable: true, description: 'Total amount of ecash issued'})
	total_issued: string;

	@Field({nullable: true, description: 'Total amount of ecash redeemed'})
	total_redeemed: string;

	@Field({nullable: true, description: 'Long description of the mint'})
	description_long: string;

	@Field(() => [OrchardContact], {description: 'Mint contact methods'})
	contact: OrchardContact[];

	@Field({nullable: true, description: 'Mint icon URL'})
	icon_url: string;

	@Field(() => [String], {description: 'Mint URLs'})
	urls: string[];

	constructor(cashu_info: CashuMintInfoRpc) {
		this.name = cashu_info.name;
		this.version = cashu_info.version;
		this.description = cashu_info.description;
		this.description_long = cashu_info.description_long;
		this.motd = cashu_info.motd;
		this.total_issued = cashu_info.total_issued;
		this.total_redeemed = cashu_info.total_redeemed;
		this.contact = cashu_info.contact;
		this.icon_url = cashu_info.icon_url;
		this.urls = cashu_info.urls;
	}
}

@ObjectType({description: 'Mint name update result'})
export class OrchardMintNameUpdate {
	@Field({nullable: true, description: 'Updated mint name'})
	name: string;
}

@ObjectType({description: 'Mint icon update result'})
export class OrchardMintIconUpdate {
	@Field({description: 'Updated icon URL'})
	icon_url: string;
}

@ObjectType({description: 'Mint description update result'})
export class OrchardMintDescriptionUpdate {
	@Field({description: 'Updated description'})
	description: string;
}

@ObjectType({description: 'Mint message of the day update result'})
export class OrchardMintMotdUpdate {
	@Field({nullable: true, description: 'Updated message of the day'})
	motd: string;
}

@ObjectType({description: 'Mint URL update result'})
export class OrchardMintUrlUpdate {
	@Field({description: 'Updated URL'})
	url: string;
}

@ObjectType({description: 'Mint contact update result'})
export class OrchardMintContactUpdate {
	@Field({description: 'Contact method type'})
	method: string;

	@Field({description: 'Contact information value'})
	info: string;
}
