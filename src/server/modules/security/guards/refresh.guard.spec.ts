/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {GqlRefreshGuard} from './refresh.guard.js';

describe('GqlRefreshGuard', () => {
	let guard: GqlRefreshGuard;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GqlRefreshGuard],
		}).compile();

		guard = module.get<GqlRefreshGuard>(GqlRefreshGuard);
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	it('returns user when valid', () => {
		const mock_user = {id: '1', name: 'Alice'};

		const result = guard.handleRequest(null, mock_user);

		expect(result).toEqual(mock_user);
	});

	it('throws OrchardApiError when user is missing', () => {
		expect(() => guard.handleRequest(null, null)).toThrow(OrchardApiError);
	});

	it('throws OrchardApiError when error is present', () => {
		expect(() => guard.handleRequest(new Error('token expired'), null)).toThrow(OrchardApiError);
	});
});
