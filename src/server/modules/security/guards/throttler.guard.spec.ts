/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {ThrottlerStorage} from '@nestjs/throttler';
/* Local Dependencies */
import {GqlThrottlerGuard} from './throttler.guard.js';

describe('GqlThrottlerGuard', () => {
	let guard: GqlThrottlerGuard;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GqlThrottlerGuard,
				{
					provide: ThrottlerStorage,
					useValue: {increment: jest.fn().mockResolvedValue({totalHits: 1, timeToExpire: 60})},
				},
				{provide: 'THROTTLER:MODULE_OPTIONS', useValue: {throttlers: [{name: 'default', ttl: 60, limit: 10}]}},
			],
		}).compile();

		guard = module.get<GqlThrottlerGuard>(GqlThrottlerGuard);
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});
});
