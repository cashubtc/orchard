/* Vendor Dependencies */
import {StaleKeysetError, isMintOperationError} from '@cashu/cashu-ts';
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
/* Local Dependencies */
import {CashuMintErrorCode, CashuMintLegacyErrorCode, WalletErrorAction} from '../cashuwallet.enums.js';

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
