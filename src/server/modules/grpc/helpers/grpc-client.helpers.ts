/* Vendor Dependencies */
import type {Client} from '@grpc/grpc-js';

/** Release the transport directly; generated services can define a close RPC. */
export function closeGrpcChannel(client: Client | null | undefined): void {
	client?.getChannel().close();
}
