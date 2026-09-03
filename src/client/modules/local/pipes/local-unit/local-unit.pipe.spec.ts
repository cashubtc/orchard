/* Local Dependencies */
import {LocalUnitPipe} from './local-unit.pipe';

describe('LocalUnitPipe', () => {
	const pipe = new LocalUnitPipe();

	it('create an instance', () => {
		expect(pipe).toBeTruthy();
	});

	it('should render sat lowercase trailing and uppercase as a title', () => {
		expect(pipe.transform('sat')).toBe('sat');
		expect(pipe.transform('sat', true)).toBe('SAT');
	});

	it('should render msat as sat', () => {
		expect(pipe.transform('msat')).toBe('sat');
	});

	it('should uppercase known currency codes', () => {
		expect(pipe.transform('usd')).toBe('USD');
		expect(pipe.transform('eur', true)).toBe('EUR');
		expect(pipe.transform('btc')).toBe('BTC');
	});

	it('should keep an unknown unit in the mint own casing', () => {
		expect(pipe.transform('ora')).toBe('ora');
		expect(pipe.transform('ora', true)).toBe('ora');
	});

	it('should return an empty string for a missing unit', () => {
		expect(pipe.transform(null as any)).toBe('');
	});
});
