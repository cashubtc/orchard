export type NormalizedFederation<T> = T extends `${string}_UNSPECIFIED`
	? undefined
	: T extends Array<infer U>
		? NormalizedFederation<U>[]
		: T extends object
			? {[K in keyof T]: NormalizedFederation<T[K]>}
			: T;

/** Treat all unspecified federation enum names as absent while preserving counters and future names. */
export function normalizeFederationEnums<T>(value: T): NormalizedFederation<T> {
	if (typeof value === 'string' && value.endsWith('_UNSPECIFIED')) return undefined;
	if (Array.isArray(value)) return value.map((item: unknown) => normalizeFederationEnums(item)) as NormalizedFederation<T>;
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, normalizeFederationEnums(item)]),
		) as NormalizedFederation<T>;
	}
	return value as NormalizedFederation<T>;
}
