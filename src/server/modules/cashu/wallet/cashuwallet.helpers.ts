/* Vendor Dependencies */
import {HttpResponseError, StaleKeysetError, isMintOperationError} from '@cashu/cashu-ts';
/* Application Dependencies */
import {OrchardErrorCode, OrchardErrorMessages} from '#server/modules/error/error.types';
/* Local Dependencies */
import {CashuMintErrorCode} from './cashuwallet.enums.js';

const AUTH_CODES = new Set<number>([
	CashuMintErrorCode.CLEAR_AUTH_REQUIRED,
	CashuMintErrorCode.CLEAR_AUTH_FAILED,
	CashuMintErrorCode.BLIND_AUTH_REQUIRED,
	CashuMintErrorCode.BLIND_AUTH_FAILED,
	CashuMintErrorCode.BAT_MINT_MAX_EXCEEDED,
	CashuMintErrorCode.BAT_RATE_LIMIT_EXCEEDED,
]);

/** Operator-facing wallet error, resolved to EcashWalletError with its details */
export const walletError = (details: string) => ({code: OrchardErrorCode.EcashWalletError, details});

/** Thrown by the guarded mint transport when a mint URL resolves to a private or local address */
export class MintAddressError extends Error {
	name = 'MintAddressError';
}

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
