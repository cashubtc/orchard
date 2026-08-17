/* Core Dependencies */
import {Kind, type ValueNode} from 'graphql';
import {GraphQLScalarType} from 'graphql';

function isValidBase64(str: string): boolean {
	const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
	if (!base64Regex.test(str)) return false;
	if (str.length % 4 !== 0) return false;
	return true;
}

export const Base64 = new GraphQLScalarType({
	name: 'Base64',
	description: 'Base64 encoded string scalar type',

	parseValue(value: string): string {
		if (typeof value !== 'string') throw new Error('Base64 value must be a string');
		if (!isValidBase64(value)) throw new Error(`Invalid base64 string: ${value}`);
		return value;
	},

	serialize(value: string): string {
		return value;
	},

	parseLiteral(ast: ValueNode): string {
		if (ast.kind !== Kind.STRING) return null;
		return this.parseValue(ast.value);
	},
});

export type Base64Type = string;
