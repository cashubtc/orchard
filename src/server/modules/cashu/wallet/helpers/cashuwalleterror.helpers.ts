/* Vendor Dependencies */
import {HttpResponseError, StaleKeysetError, isMintOperationError} from '@cashu/cashu-ts';
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {OrchardErrorCode, OrchardErrorMessages} from '#server/modules/error/error.types';
/* Native Dependencies */
import {CashuMintErrorCode, CashuMintLegacyErrorCode, WalletErrorAction} from '#server/modules/cashu/wallet/cashuwallet.enums';

const AUTH_CODES = new Set<number>([
	CashuMintErrorCode.CLEAR_AUTH_REQUIRED,
	CashuMintErrorCode.CLEAR_AUTH_FAILED,
	CashuMintErrorCode.BLIND_AUTH_REQUIRED,
	CashuMintErrorCode.BLIND_AUTH_FAILED,
	CashuMintErrorCode.BAT_MINT_MAX_EXCEEDED,
	CashuMintErrorCode.BAT_RATE_LIMIT_EXCEEDED,
]);

// Before the renumbering 11002 meant "not balanced"; now it means "proofs are pending"
const LEGACY_NOT_BALANCED = /balanced/i;

const ACTION_BY_CODE: Partial<Record<number, WalletErrorAction>> = {
	[CashuMintErrorCode.OUTPUTS_ALREADY_SIGNED]: WalletErrorAction.RESTORE,
	[CashuMintLegacyErrorCode.OUTPUTS_ALREADY_SIGNED]: WalletErrorAction.RESTORE,
	[CashuMintErrorCode.QUOTE_ALREADY_ISSUED]: WalletErrorAction.RESTORE,
	[CashuMintErrorCode.PROOFS_ALREADY_SPENT]: WalletErrorAction.CHECK_STATE,
	[CashuMintErrorCode.PROOFS_PENDING]: WalletErrorAction.WAIT,
	[CashuMintErrorCode.OUTPUTS_PENDING]: WalletErrorAction.WAIT,
	[CashuMintErrorCode.QUOTE_PENDING]: WalletErrorAction.WAIT,
	[CashuMintErrorCode.QUOTE_NOT_PAID]: WalletErrorAction.WAIT,
	[CashuMintErrorCode.KEYSET_UNKNOWN]: WalletErrorAction.REBUILD,
	[CashuMintErrorCode.KEYSET_INACTIVE]: WalletErrorAction.REBUILD,
	[CashuMintErrorCode.KEYSET_EXPIRED]: WalletErrorAction.REBUILD,
};

/** Every code the NUT spec defines, now or before the renumbering; any not mapped above is a definitive refusal */
const SPEC_CODES = new Set<number>(
	[...Object.values(CashuMintErrorCode), ...Object.values(CashuMintLegacyErrorCode)].filter((code) => typeof code === 'number'),
);

/** Mint RPC refusals, which leave the mint untouched: Orchard's codes for mapped gRPC statuses, and statuses it passes through raw */
const RPC_REFUSALS = new Set<number>([
	OrchardErrorCode.MintSupportError,
	OrchardErrorCode.MintRpcInvalidArgumentError,
	status.PERMISSION_DENIED,
	status.FAILED_PRECONDITION,
]);

/** Operator-facing wallet error, resolved to EcashWalletError with its details */
export const walletError = (details: string) => ({code: OrchardErrorCode.EcashWalletError, details});

/** Any failure as an operator-readable wallet error, so NUT codes never pass as Orchard codes; wallet errors pass through */
export const toWalletError = (error: unknown) => walletError(describeMintError(error));

/** Operator-readable description of a failed mint or mint RPC call, naming the NUT error code when the mint sent one */
export const describeMintError = (error: unknown): string => {
	const mint_error = error instanceof StaleKeysetError && isMintOperationError(error.cause) ? error.cause : error;
	if (isMintOperationError(mint_error)) {
		const auth = AUTH_CODES.has(mint_error.code) ? '; this mint requires authentication, which Orchard wallets do not support yet' : '';
		return `Mint error ${mint_error.code}: ${mint_error.message}${auth}`;
	}
	if (error instanceof HttpResponseError) return `${error.message} (HTTP ${error.status})`;
	if (error instanceof Error) return error.message;
	const orchard_error = (typeof error === 'number' ? {code: error} : error) as {code?: number; details?: string} | null;
	return orchard_error?.details ?? OrchardErrorMessages[orchard_error?.code ?? ''] ?? String(error);
};

/** Decide what a journaled operation does after a mint call fails: spec refusals are definitive, unknown codes check state, transport failures wait */
export const classifyMintError = (error: unknown): WalletErrorAction => {
	if (error instanceof StaleKeysetError) return WalletErrorAction.REBUILD;
	if (!isMintOperationError(error)) return WalletErrorAction.WAIT;
	if (error.code === CashuMintErrorCode.PROOFS_PENDING && LEGACY_NOT_BALANCED.test(error.message)) return WalletErrorAction.FAIL;
	return ACTION_BY_CODE[error.code] ?? (SPEC_CODES.has(error.code) ? WalletErrorAction.FAIL : WalletErrorAction.CHECK_STATE);
};

/** Decide what a journaled operation does after a mint RPC call fails: refusals fail, anything that may have applied waits */
export const classifyMintRpcError = (error: unknown): WalletErrorAction => {
	if (typeof error === 'number') return WalletErrorAction.FAIL; // CashuMintRpcService throws bare codes only before sending
	const code = (error as {code?: unknown} | null)?.code;
	return typeof code === 'number' && RPC_REFUSALS.has(code) ? WalletErrorAction.FAIL : WalletErrorAction.WAIT;
};
