import {Kind, type ValueNode} from 'graphql';
import {GraphQLScalarType} from 'graphql';

export const Timezone = new GraphQLScalarType({
	name: 'Timezone',
	description: 'Timezone custom scalar type based on IANA timezone database',

	parseValue(value: string): string {
		const supported_timezones = (Intl as any).supportedValuesOf('timeZone');
		if (!supported_timezones.includes(value)) throw new Error(`Invalid timezone: ${value}`);
		return value;
	},

	serialize(value: string): string {
		return value;
	},

	parseLiteral(ast: ValueNode): string {
		if (ast.kind === Kind.STRING) return this.parseValue(ast.value);
		throw new Error('Timezone must be a string');
	},
});

const _supported_timezones = (Intl as any).supportedValuesOf('timeZone') as string[];
export type TimezoneType = (typeof _supported_timezones)[number];
