/* Vendor Dependencies */
import {HttpResponseError, RateLimitError, StaleKeysetError, isMintOperationError} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuMintErrorCode, WalletErrorAction} from './cashuwallet.enums.js';

const AUTH_CODES = new Set<number>([
	CashuMintErrorCode.CLEAR_AUTH_REQUIRED,
	CashuMintErrorCode.CLEAR_AUTH_FAILED,
	CashuMintErrorCode.BLIND_AUTH_REQUIRED,
	CashuMintErrorCode.BLIND_AUTH_FAILED,
	CashuMintErrorCode.BAT_MINT_MAX_EXCEEDED,
	CashuMintErrorCode.BAT_RATE_LIMIT_EXCEEDED,
]);

const ACTION_BY_CODE: Partial<Record<number, WalletErrorAction>> = {
	[CashuMintErrorCode.OUTPUTS_ALREADY_SIGNED]: WalletErrorAction.RESTORE,
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

/** Decide what a journaled operation does after a mint call fails; unknown outcomes wait, only definitive rejections fail */
export const classifyMintError = (error: unknown): WalletErrorAction => {
	if (error instanceof StaleKeysetError) return WalletErrorAction.REBUILD;
	if (isMintOperationError(error)) return ACTION_BY_CODE[error.code] ?? WalletErrorAction.FAIL;
	if (error instanceof HttpResponseError && !(error instanceof RateLimitError) && error.status < 500) return WalletErrorAction.FAIL;
	return WalletErrorAction.WAIT;
};

/** Operator-readable description of a mint call failure, naming the NUT error code when the mint sent one */
export const describeMintError = (error: unknown): string => {
	if (isMintOperationError(error)) {
		const auth = AUTH_CODES.has(error.code) ? '; this mint requires authentication, which Orchard wallets do not support yet' : '';
		return `Mint error ${error.code}: ${error.message}${auth}`;
	}
	if (error instanceof HttpResponseError) return `${error.message} (HTTP ${error.status})`;
	return error instanceof Error ? error.message : String(error);
};
