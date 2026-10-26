/* Core Dependencies */
import {Test} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {GraphQLSchemaBuilderModule, GraphQLSchemaFactory} from '@nestjs/graphql';

/* Vendor Dependencies */
import {graphql} from 'graphql';
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import {FederationSettingsService} from '#server/modules/federation/federation-settings.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {CdkRpcError} from '#server/modules/cashu/cdk/classes/cdk-rpc-error.class';
import {PUBLIC_KEY, ROLES_KEY} from '#server/modules/auth/decorators/auth.decorator';

/* Local Dependencies */
import {FederationSettingsResolver} from './federation-settings.resolver.js';

describe('Federation settings comparison API', () => {
	it('uses normal authenticated read access', () => {
		const reflector = new Reflector();
		const targets = [FederationSettingsResolver.prototype.federation_settings_comparison, FederationSettingsResolver];
		expect(reflector.getAllAndOverride(PUBLIC_KEY, targets)).not.toBe(true);
		expect(reflector.getAllAndOverride(ROLES_KEY, targets)).toBeUndefined();
	});

	it('forwards explicit refreshes and maps upstream errors without replacing the diagnostic', async () => {
		const getComparison = jest.fn().mockResolvedValue({});
		const module = await Test.createTestingModule({
			providers: [FederationSettingsResolver, ErrorService, {provide: FederationSettingsService, useValue: {getComparison}}],
		}).compile();
		const resolver = module.get(FederationSettingsResolver);
		await resolver.federation_settings_comparison();
		expect(getComparison).toHaveBeenLastCalledWith(false);
		await resolver.federation_settings_comparison(true);
		expect(getComparison).toHaveBeenLastCalledWith(true);
		getComparison.mockRejectedValue(new CdkRpcError(status.UNAVAILABLE, 'RPC connection refused'));
		await expect(resolver.federation_settings_comparison()).rejects.toMatchObject({
			extensions: {code: OrchardErrorCode.MintRpcConnectionError, details: 'RPC connection refused'},
		});
		await module.close();
	});

	it('exposes typed statuses, structured differences, the default quote member and a Unix timestamp', async () => {
		const module = await Test.createTestingModule({imports: [GraphQLSchemaBuilderModule]}).compile();
		const schema = await module.get(GraphQLSchemaFactory).create([FederationSettingsResolver]);
		const read = jest.fn().mockReturnValue({
			federation_id: 'f',
			local_member_id: 1,
			default_quote_member_id: 1,
			checked_at: 1792929600,
			baseline_available: true,
			members: [
				{
					member_id: 2,
					local: false,
					public_mint_url: 'https://mint2',
					federation_api_url: 'https://peer2',
					status: 'differs',
					error: null,
					differences: [
						{
							group: 'config',
							setting: 'disabled',
							nut: 4,
							method: null,
							unit: null,
							this_member_value: 'false',
							their_value: 'true',
						},
					],
				},
			],
		});
		const result = await graphql({
			schema,
			source: '{ federation_settings_comparison { federation_id local_member_id default_quote_member_id checked_at baseline_available members { member_id local public_mint_url federation_api_url status error differences { group setting nut method unit this_member_value their_value } } } }',
			rootValue: {federation_settings_comparison: read},
		});
		expect(result.errors).toBeUndefined();
		expect(read.mock.calls[0][0]).toEqual({refresh: false});
		expect(result.data?.federation_settings_comparison).toEqual(read.mock.results[0].value);
		await module.close();
	});
});
