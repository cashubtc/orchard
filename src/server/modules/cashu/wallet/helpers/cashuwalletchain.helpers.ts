/* Native Dependencies */
import type {CashuWalletChainDeposit} from '#server/modules/cashu/wallet/cashuwallet.types';

/** An outpoint (txid:vout) as its parts, or null when it isn't one */
export function parseOutpoint(outpoint: string): {txid: string; vout: number} | null {
	const match = /^([0-9a-f]{64}):(\d+)$/i.exec(outpoint);
	return match ? {txid: match[1].toLowerCase(), vout: Number(match[2])} : null;
}

/** Confirmations of a transaction in the block at a height, with the chain's tip at another: 1 in the tip itself */
export function chainConfirmations(tip: number, height: number): number {
	return tip - height + 1;
}

/** Whether the mint has credited a deposit: its paid total reached the one the deposit brings it to; one under the minimum never is */
export function isDepositCredited(deposit: Pick<CashuWalletChainDeposit, 'paid_when_credited'>, amount_paid: number): boolean {
	return deposit.paid_when_credited !== null && amount_paid >= deposit.paid_when_credited;
}
