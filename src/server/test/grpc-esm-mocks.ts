/**
 * Replaces the gRPC modules for specs that construct a gRPC client.
 *
 * Under ESM a namespace import is sealed and its exports are snapshotted, so a top-level
 * export cannot be spied — it has to be swapped at the module level. Nested objects such
 * as `grpc.credentials` stay shared by reference and are still spy-able.
 *
 * Must be called before importing the service under test, and must never import the gRPC
 * modules statically: that would evaluate the real ones before the mocks register.
 */
export async function mockGrpcModules(): Promise<{proto_loader: any; grpc: any}> {
	jest.unstable_mockModule('@grpc/proto-loader', () => {
		const actual = jest.requireActual('@grpc/proto-loader') as object;
		return {...actual, loadSync: jest.fn(), default: actual};
	});
	jest.unstable_mockModule('@grpc/grpc-js', () => {
		const actual = jest.requireActual('@grpc/grpc-js') as object;
		return {...actual, loadPackageDefinition: jest.fn(), default: actual};
	});
	return {
		proto_loader: (await import('@grpc/proto-loader')) as any,
		grpc: (await import('@grpc/grpc-js')) as any,
	};
}
