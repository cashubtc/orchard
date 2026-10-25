/* Native Dependencies */
import {FEDERATION_ABSENT_ENUMS} from '#server/modules/federation/constants/federation.constants';

type AbsentEnum = (typeof FEDERATION_ABSENT_ENUMS)[number];
export type NormalizedFederation<T> = T extends string
	? Extract<T, AbsentEnum> extends never
		? T
		: Exclude<T, AbsentEnum> | undefined
	: T extends Array<infer U>
		? NormalizedFederation<U>[]
		: T extends object
			? {[K in keyof T]: NormalizedFederation<T[K]>}
			: T;

/** Normalize only known zero enum names at the federation boundary; preserve unknown values and exact counters. */
export function normalizeFederationEnums<T>(value: T): NormalizedFederation<T> {
	if (typeof value === 'string' && (FEDERATION_ABSENT_ENUMS as readonly string[]).includes(value)) return undefined;
	if (Array.isArray(value)) return value.map((item: unknown) => normalizeFederationEnums(item)) as NormalizedFederation<T>;
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, normalizeFederationEnums(item)]),
		) as NormalizedFederation<T>;
	}
	return value as NormalizedFederation<T>;
}
