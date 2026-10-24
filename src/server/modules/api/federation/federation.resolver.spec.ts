import {Test} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {GraphQLSchemaBuilderModule, GraphQLSchemaFactory} from '@nestjs/graphql';
import {graphql, type GraphQLSchema} from 'graphql';
import {PUBLIC_KEY, ROLES_KEY} from '#server/modules/auth/decorators/auth.decorator';
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
