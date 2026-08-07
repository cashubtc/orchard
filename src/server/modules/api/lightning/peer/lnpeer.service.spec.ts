/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
/* Local Dependencies */
import {LightningPeerService} from './lnpeer.service.js';

describe('LightningPeerService', () => {
	let lightningPeerService: LightningPeerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningPeerService,
				{
					provide: LightningService,
					useValue: {getPeers: jest.fn().mockResolvedValue([])},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		lightningPeerService = module.get<LightningPeerService>(LightningPeerService);
	});

	it('should be defined', () => {
		expect(lightningPeerService).toBeDefined();
	});
});
