/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Local Dependencies */
import {StatusService} from './status.service.js';
import {OrchardStatus} from './status.model.js';

describe('StatusService', () => {
	let service: StatusService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [StatusService],
		}).compile();

		service = module.get<StatusService>(StatusService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns OrchardStatus with online true and expected title', () => {
		const result = service.getStatus();
		expect(result).toBeInstanceOf(OrchardStatus);
		expect(result.online).toBe(true);
		expect(result.title).toBe('Orchard Graphql Server');
	});
});
