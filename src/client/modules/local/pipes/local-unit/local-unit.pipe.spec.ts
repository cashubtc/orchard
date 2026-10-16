/* Local Dependencies */
import {LocalUnitPipe} from './local-unit.pipe';

describe('LocalUnitPipe', () => {
	const pipe = new LocalUnitPipe();

	it('create an instance', () => {
		expect(pipe).toBeTruthy();
	});

	it('should uppercase every unit, custom ones included', () => {
		expect(pipe.transform('sat')).toBe('SAT');
		expect(pipe.transform('usd')).toBe('USD');
		expect(pipe.transform('btc')).toBe('BTC');
		expect(pipe.transform('ora')).toBe('ORA');
	});

	it('should render msat as sat', () => {
		expect(pipe.transform('msat')).toBe('SAT');
	});

	it('should return an empty string for a missing unit', () => {
		expect(pipe.transform(null as any)).toBe('');
	});
});
