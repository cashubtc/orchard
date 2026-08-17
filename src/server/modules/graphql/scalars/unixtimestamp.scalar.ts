/* Core Dependencies */
import {Kind, type ValueNode} from 'graphql';
import {GraphQLScalarType} from 'graphql';

export const UnixTimestamp = new GraphQLScalarType({
	name: 'UnixTimestamp',
	description: 'A Unix timestamp in seconds',

	parseValue(value: number): number {
		return value;
	},

	serialize(value: number): number {
		return value;
	},

	parseLiteral(ast: ValueNode): number | null {
		if (ast.kind !== Kind.INT) return null;
		const intValue = parseInt(ast.value, 10);
		return /^[0-9]{10}$/.test(intValue.toString()) ? intValue : null;
	},
});
