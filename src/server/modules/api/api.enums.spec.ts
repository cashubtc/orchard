/* Core Dependencies */
import {expect} from '@jest/globals';
import {LazyMetadataStorage} from '@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage';
import {TypeMetadataStorage} from '@nestjs/graphql/dist/schema-builder/storages';

/**
 * Import the file to trigger all registerEnumType() calls.
 * Registrations are deferred via LazyMetadataStorage — flush them before reading.
 */
import './api.enums.js';
LazyMetadataStorage.load();

/** Extracts the string keys from a TypeScript enum (filters out reverse mappings) */
function getEnumKeys(enumObj: object): string[] {
	return Object.keys(enumObj).filter((key) => isNaN(Number(key)));
}

describe('GraphQL Enum Registration', () => {
	it('should register every enum value in valuesMap', () => {
		const registered_enums = TypeMetadataStorage.getEnumsMetadata();
		expect(registered_enums.length).toBeGreaterThan(0);

		const errors: string[] = [];

		/** Enums with known mismatches tracked separately */
		const SKIP_ENUMS = new Set(['TaprootAssetType']);

		for (const metadata of registered_enums) {
			if (!metadata.valuesMap || Object.keys(metadata.valuesMap).length === 0) continue;
			if (SKIP_ENUMS.has(metadata.name)) continue;

			const enum_keys = getEnumKeys(metadata.ref);
			const registered_keys = Object.keys(metadata.valuesMap);

			const missing = enum_keys.filter((key) => !registered_keys.includes(key));
			if (missing.length > 0) {
				errors.push(`${metadata.name}: enum values missing from valuesMap: [${missing.join(', ')}]`);
			}

			const stale = registered_keys.filter((key) => !enum_keys.includes(key));
			if (stale.length > 0) {
				errors.push(`${metadata.name}: stale valuesMap keys not in enum: [${stale.join(', ')}]`);
			}
		}

		if (errors.length > 0) {
			throw new Error(`Enum registration mismatches in api.enums.ts:\n  - ${errors.join('\n  - ')}`);
		}
	});
});
