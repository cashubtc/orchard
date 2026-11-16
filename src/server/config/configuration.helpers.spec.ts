/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {getDataDir} from './configuration.helpers.js';

describe('Configuration Helpers', () => {
	const original_env = {...process.env};

	beforeEach(() => {
		process.env = {...original_env};
		delete process.env.DATA_DIR;
		delete process.env.DATABASE_DIR;
	});

	afterEach(() => {
		process.env = original_env;
	});

	describe('getDataDir', () => {
		it('should default to data', () => {
			expect(getDataDir()).toBe('data');
		});

		it('should fall back to the legacy DATABASE_DIR', () => {
			process.env.DATABASE_DIR = '/legacy/path';
			expect(getDataDir()).toBe('/legacy/path');
		});

		it('should prefer DATA_DIR over DATABASE_DIR', () => {
			process.env.DATA_DIR = '/data/path';
			process.env.DATABASE_DIR = '/legacy/path';
			expect(getDataDir()).toBe('/data/path');
		});
	});
});
