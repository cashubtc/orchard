/** @types/jest ships unstable_unmockModule but not its counterpart. */
declare namespace jest {
	function unstable_mockModule(module_name: string, factory: () => unknown, options?: {virtual?: boolean}): typeof jest;
}
