import {Test} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {GraphQLSchemaBuilderModule, GraphQLSchemaFactory} from '@nestjs/graphql';
import {graphql, isObjectType, isInputObjectType, isNonNullType, type GraphQLSchema} from 'graphql';
import {PUBLIC_KEY, ROLES_KEY} from '#server/modules/auth/decorators/auth.decorator';
import {FederationSetupResolver} from './federation-setup.resolver.js';
import {normalizeFederationEnums} from '#server/modules/federation/helpers/federation-enums.helpers';
import {loadSync, type ServiceDefinition} from '@grpc/proto-loader';
import {FederationResolver} from './federation.resolver.js';

describe('Federation read API', () => {
	let schema: GraphQLSchema;
	beforeAll(async () => {
		const module = await Test.createTestingModule({imports: [GraphQLSchemaBuilderModule]}).compile();
		schema = await module.get(GraphQLSchemaFactory).create([FederationResolver]);
	});
	it.each(['federation_info', 'federation_local_status', 'federation_member_statuses', 'federation_custody_status'] as const)(
		'uses authenticated mint-read access for %s',
		(method) => {
			const reflector = new Reflector();
			const targets = [FederationResolver.prototype[method], FederationResolver];
			expect(reflector.getAllAndOverride(PUBLIC_KEY, targets)).not.toBe(true);
			expect(reflector.getAllAndOverride(ROLES_KEY, targets)).toBeUndefined();
		},
	);
	it('keeps absent custody sections null and never exposes mutations', async () => {
		const result = await graphql({
			schema,
			source: '{ federation_custody_status { onchain_wallets { source } wallet_operator { network } wallet_recovery { sticky_reservations } wallet_liveness { activity } bark { readiness } } }',
			rootValue: {federation_custody_status: () => ({onchain_wallets: []})},
		});
		expect(result.errors).toBeUndefined();
		expect(result.data?.federation_custody_status).toEqual({
			onchain_wallets: [],
			wallet_operator: null,
			wallet_recovery: null,
			wallet_liveness: null,
			bark: null,
		});
		expect(schema.getMutationType()).toBeUndefined();
	});
	it('serializes uint64 counters as exact strings and accepts future enum names', async () => {
		const result = await graphql({
			schema,
			source: '{ federation_member_statuses { queried_at_unix members { latency_ms } digest_agreement { state } } }',
			rootValue: {
				federation_member_statuses: () => ({
					queried_at_unix: '18446744073709551615',
					members: [{latency_ms: '9007199254740993'}],
					digest_agreement: {state: 'FUTURE_STATE'},
				}),
			},
		});
		expect(result.errors).toBeUndefined();
		expect(result.data?.federation_member_statuses).toEqual({
			queried_at_unix: '18446744073709551615',
			members: [{latency_ms: '9007199254740993'}],
			digest_agreement: {state: 'FUTURE_STATE'},
		});
	});
});

describe('Federation GraphQL contracts', () => {
	let schema: GraphQLSchema;
	beforeAll(async () => {
		const module = await Test.createTestingModule({imports: [GraphQLSchemaBuilderModule]}).compile();
		schema = await module.get(GraphQLSchemaFactory).create([FederationResolver, FederationSetupResolver]);
		await module.close();
	});
	it('documents every federation field, setup input, query, mutation and argument', () => {
		for (const type of Object.values(schema.getTypeMap())) {
			if (!type.name.includes('Federation') || (!isObjectType(type) && !isInputObjectType(type))) continue;
			for (const field of Object.values(type.getFields()))
				expect({field: `${type.name}.${field.name}`, description: field.description}).toEqual({
					field: `${type.name}.${field.name}`,
					description: expect.any(String),
				});
		}
		for (const type of [schema.getQueryType(), schema.getMutationType()]) {
			for (const field of Object.values(type.getFields())) {
				expect(field.description).toBeTruthy();
				for (const arg of field.args) expect(arg.description).toBeTruthy();
			}
		}
	});
	it('keeps every exposed protobuf enum nullable', () => {
		const enum_fields: Record<string, string[]> = {
			PaymentVerificationPolicy: ['kind'],
			SyncStatus: ['state'],
			PaymentObservationReport: ['context', 'status', 'recommended_action'],
			DigestConflict: ['kind'],
			DigestAgreement: ['state'],
			OnchainWalletSource: ['health'],
			WalletUtxoCount: ['state'],
			WalletOperationPhaseCount: ['phase'],
			WalletOperatorStatus: ['broadcast_health'],
			WalletRecoveryActionCount: ['phase', 'action'],
			WalletLivenessStatus: ['activity'],
			BarkOperatorStatus: ['readiness'],
			SetupDkg: ['phase'],
			SetupStatus: ['role', 'participant_phase', 'coordinator_phase'],
		};
		for (const [name, fields] of Object.entries(enum_fields)) {
			const type = schema.getType(`OrchardFederation${name}`);
			if (!isObjectType(type)) throw new Error(`Missing model ${name}`);
			for (const name of fields) expect(isNonNullType(type.getFields()[name].type)).toBe(false);
		}
	});
	it('serializes normalized proto defaults as null instead of rejecting federation responses', async () => {
		const definitions = loadSync('proto/cdk/federation.proto', {keepCase: true, longs: String, enums: String, defaults: true});
		const service = definitions['cdk_mint_federation_v1.FederationService'] as ServiceDefinition;
		const info = service.GetFederationInfo.responseDeserialize(
			service.GetFederationInfo.responseSerialize({payment_observation_policy: {mint_quotes: {}, melt_quotes: {}}}),
		);
		const custody = service.GetCustodyStatus.responseDeserialize(
			service.GetCustodyStatus.responseSerialize({
				wallet_operator: {utxos: [{}], operation_phases: [{}]},
				wallet_recovery: {actions: [{}]},
				wallet_liveness: {},
				bark: {},
				onchain_wallets: [{}],
			}),
		);
		const result = await graphql({
			schema,
			source: '{ federation_info { payment_observation_policy { mint_quotes { kind } melt_quotes { kind } } } federation_custody_status { onchain_wallets { health } wallet_operator { broadcast_health utxos { state } operation_phases { phase } } wallet_recovery { actions { phase action } } wallet_liveness { activity } bark { readiness } } }',
			rootValue: {
				federation_info: () => normalizeFederationEnums(info),
				federation_custody_status: () => normalizeFederationEnums(custody),
			},
		});
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			federation_info: {payment_observation_policy: {mint_quotes: {kind: null}, melt_quotes: {kind: null}}},
			federation_custody_status: {
				onchain_wallets: [{health: null}],
				wallet_operator: {broadcast_health: null, utxos: [{state: null}], operation_phases: [{phase: null}]},
				wallet_recovery: {actions: [{phase: null, action: null}]},
				wallet_liveness: {activity: null},
				bark: {readiness: null},
			},
		});
	});
});
