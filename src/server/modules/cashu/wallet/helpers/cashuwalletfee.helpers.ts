/* Vendor Dependencies */
import type {Proof, Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import type {CashuWalletSpendEstimate} from '#server/modules/cashu/wallet/cashuwallet.types';

/** What spending an amount plus a surcharge costs: the input fee of the proofs a send would pick, reserving none; short, it prices spending them all */
export const estimateFee = (wallet: Wallet, ready: Proof[], amount: number, surcharge: number): CashuWalletSpendEstimate => {
	const {send} = wallet.selectProofsToSend(ready, amount + surcharge, true);
	const sufficient = send.length > 0;
	const fee = surcharge + wallet.getFeesForProofs(sufficient ? send : ready).toNumber();
	return {fee, total: amount + fee, sufficient};
};
