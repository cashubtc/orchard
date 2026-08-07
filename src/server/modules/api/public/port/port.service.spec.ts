/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {expect} from '@jest/globals';
/* Local Dependencies */
import {PublicPortService} from './port.service.js';
import {OrchardPublicPort} from './port.model.js';

describe('PublicPortService', () => {
	let service: PublicPortService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PublicPortService, {provide: ConfigService, useValue: {get: jest.fn().mockReturnValue(null)}}],
		}).compile();

		service = module.get<PublicPortService>(PublicPortService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('blocks private IPs (SSRF protection)', async () => {
		const result = await service.getPortsData([{host: '127.0.0.1', port: 99999}]);

		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(OrchardPublicPort);
		expect(result[0].host).toBe('127.0.0.1');
		expect(result[0].reachable).toBe(false);
		expect(result[0].error).toContain('private/reserved');
	});

	it('returns unreachable for .onion without proxy configured', async () => {
		const result = await service.getPortsData([{host: 'test.onion', port: 80}]);

		expect(result).toHaveLength(1);
		expect(result[0].reachable).toBe(false);
		expect(result[0].error).toBe('No Tor proxy configured');
	});
});
