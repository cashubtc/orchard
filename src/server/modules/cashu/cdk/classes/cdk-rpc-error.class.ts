/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';

/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';

const CDK_RPC_ERROR_CODES: Partial<Record<status, OrchardErrorCode>> = {
	[status.INVALID_ARGUMENT]: OrchardErrorCode.MintRpcInvalidArgumentError,
	[status.FAILED_PRECONDITION]: OrchardErrorCode.MintRpcPreconditionError,
	[status.RESOURCE_EXHAUSTED]: OrchardErrorCode.MintRpcBusyError,
	[status.UNIMPLEMENTED]: OrchardErrorCode.MintSupportError,
	[status.UNAVAILABLE]: OrchardErrorCode.MintRpcConnectionError,
	[status.DEADLINE_EXCEEDED]: OrchardErrorCode.MintRpcConnectionError,
	[status.INTERNAL]: OrchardErrorCode.MintRpcInternalError,
};

/** An Orchard error retaining both the transport status and CDK's exact diagnostic. */
export class CdkRpcError extends Error {
	public readonly code: OrchardErrorCode;
	public readonly grpc_code: number;
	public readonly details: string;

	constructor(grpc_code: number, details: string) {
		// An unknown service answers with an empty message; the status name is the only diagnostic left
		const diagnostic = details || status[grpc_code] || `gRPC status ${grpc_code}`;
		super(diagnostic);
		this.grpc_code = grpc_code;
		this.details = diagnostic;
		this.code = CDK_RPC_ERROR_CODES[grpc_code] ?? OrchardErrorCode.MintRpcActionError;
	}
}
