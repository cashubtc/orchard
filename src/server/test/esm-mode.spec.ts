/**
 * Guards the ESM test harness.
 *
 * Without `--experimental-vm-modules`, jest silently ignores `extensionsToTreatAsEsm`,
 * ts-jest emits CommonJS, and the whole suite passes without ever exercising ESM. This
 * spec fails loudly in that case: `import.meta` is only valid in an ES module. The specs
 * that use top-level await would also fail, but the other ~100 would silently pass as CJS.
 */
describe('ESM test harness', () => {
	it('runs specs as real ES modules', () => {
		expect(typeof import.meta.url).toBe('string');
	});
});
