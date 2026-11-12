/* Native Dependencies */
import {WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';

/** Emitted whenever a wallet operation changes state, with the operation minus the ecash it carries */
export const CASHU_WALLET_OPERATION_UPDATED = 'cashu.wallet.operation.updated';

const STATE_IS_FINAL: Record<WalletOperationState, boolean> = {
	[WalletOperationState.PENDING]: false,
	[WalletOperationState.EXECUTING]: false,
	[WalletOperationState.FINALIZED]: true,
	[WalletOperationState.FAILED]: true,
	[WalletOperationState.RECLAIMED]: true,
};

/** States a wallet operation is still settling in */
export const CASHU_WALLET_OPEN_STATES: WalletOperationState[] = Object.values(WalletOperationState).filter(
	(state) => !STATE_IS_FINAL[state],
);

/** States a wallet operation never leaves */
export const CASHU_WALLET_FINAL_STATES: ReadonlySet<WalletOperationState> = new Set(
	Object.values(WalletOperationState).filter((state) => STATE_IS_FINAL[state]),
);

/** Most a mint response or websocket message may carry */
export const CASHU_WALLET_MINT_MAX_BYTES = 256 * 1024;
