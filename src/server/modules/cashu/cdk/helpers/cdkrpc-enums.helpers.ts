/* Vendor Dependencies */
import type {MessageTypeDefinition, PackageDefinition} from '@grpc/proto-loader';

type MessageDescriptor = {field: Array<{name: string; type: string; typeName: string}>};

/** Label unknown numeric enums using protobuf fields so counters and numeric strings stay intact. */
export function normalizeCdkResponseEnums<T>(
	response: T,
	definition: MessageTypeDefinition<object, object>,
	definitions: PackageDefinition,
	namespace: string,
): T {
	if (response == null || typeof response !== 'object') return response;
	const result = {...response} as Record<string, unknown>;
	for (const field of (definition.type as MessageDescriptor).field) {
		if (!(field.name in result)) continue;
		/** Convert enum values and descend only into protobuf messages. */
		const normalize = (value: unknown): unknown => {
			if (field.type === 'TYPE_ENUM' && typeof value === 'number') return `Unknown enum (${value})`;
			if (field.type !== 'TYPE_MESSAGE' || value == null) return value;
			const type_name = field.typeName.startsWith('.') ? field.typeName.slice(1) : `${namespace}.${field.typeName}`;
			const nested = definitions[type_name];
			if (!nested || nested.format !== 'Protocol Buffer 3 DescriptorProto') return value;
			return normalizeCdkResponseEnums(value, nested as MessageTypeDefinition<object, object>, definitions, namespace);
		};
		const value = result[field.name];
		result[field.name] = Array.isArray(value) ? value.map(normalize) : normalize(value);
	}
	return result as T;
}
