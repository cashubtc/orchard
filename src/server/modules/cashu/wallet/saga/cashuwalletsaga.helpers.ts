/* Vendor Dependencies */
import {HttpResponseError, RateLimitError, StaleKeysetError, isMintOperationError} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuMintErrorCode, WalletErrorAction} from '../cashuwallet.enums.js';
import {MintAddressError} from '../cashuwallet.helpers.js';

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
	if (error instanceof MintAddressError) return WalletErrorAction.FAIL;
	if (error instanceof StaleKeysetError) return WalletErrorAction.REBUILD;
	if (isMintOperationError(error)) return ACTION_BY_CODE[error.code] ?? WalletErrorAction.FAIL;
	if (error instanceof HttpResponseError && !(error instanceof RateLimitError) && error.status < 500) return WalletErrorAction.FAIL;
	return WalletErrorAction.WAIT;
};
