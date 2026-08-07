/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '@server/modules/error/error.service';
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
/* Local Dependencies */
import {LightningChannelService} from './lnchannel.service.js';

describe('LightningChannelService', () => {
	let lightningChannelService: LightningChannelService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningChannelService,
				{
					provide: LightningService,
					useValue: {getChannels: jest.fn().mockResolvedValue([]), getClosedChannels: jest.fn().mockResolvedValue([])},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		lightningChannelService = module.get<LightningChannelService>(LightningChannelService);
	});

	it('should be defined', () => {
		expect(lightningChannelService).toBeDefined();
	});
});
