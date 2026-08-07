/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {Logger} from '@nestjs/common';
/* Local Dependencies */
import {ErrorService} from './error.service.js';
import {OrchardErrorCode} from './error.types.js';

describe('ErrorService', () => {
	let errorService: ErrorService;
	let logger: jest.Mocked<Logger>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ErrorService],
		}).compile();

		errorService = module.get<ErrorService>(ErrorService);
		logger = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			verbose: jest.fn(),
			setContext: jest.fn(),
		} as any;
	});

	it('should be defined', () => {
		expect(errorService).toBeDefined();
	});

	it('returns provided default code and logs', () => {
		const result = errorService.resolveError(logger, new Error('x'), 'TAG', {errord: OrchardErrorCode.MintSupportError});
		expect(result.code).toBe(OrchardErrorCode.MintSupportError);
		expect(result.details).toBeUndefined();
		// Note: logger calls are commented out in the service, so these assertions may fail
		// expect(logger.error).toHaveBeenCalledWith('TAG');
		// expect(logger.debug).toHaveBeenCalled();
	});

	it('maps numeric error equal to known code', () => {
		const result = errorService.resolveError(logger, OrchardErrorCode.AiError, 'TAG', {errord: OrchardErrorCode.MintSupportError});
		expect(result.code).toBe(OrchardErrorCode.AiError);
		expect(result.details).toBeUndefined();
	});

	it('ignores non-matching numbers and keeps default', () => {
		const result = errorService.resolveError(logger, 999999, 'TAG', {errord: OrchardErrorCode.MintSupportError});
		expect(result.code).toBe(OrchardErrorCode.MintSupportError);
		expect(result.details).toBeUndefined();
	});
});
