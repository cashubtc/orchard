/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Vendor Dependencies */
import {sumProofs, type Proof, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import {estimateFee} from '#server/modules/cashu/wallet/helpers/cashuwalletfee.helpers';
import {CashuWalletMeltQuoteMethod} from '#server/modules/cashu/wallet/classes/cashu-wallet-melt-quote-method.class';
import type {
	CashuWalletMeltQuote,
	CashuWalletMeltQuoteRecord,
	CashuWalletMeltQuoteRequest,
} from '#server/modules/cashu/wallet/cashuwallet.types';

const MAX_QUOTES = 3;

@Injectable()
export class CashuWalletMeltService {
	constructor(
		private cashuWalletMintService: CashuWalletMintService,
		private cashuWalletProofService: CashuWalletProofService,
	) {}

	/* *******************************************************
		Melt quotes
	******************************************************** */

	/** A melt quote for paying a request from a user's wallet mint, priced against their balance there; nothing is reserved, and a short balance is reported, not refused */
	public async newQuote(request: CashuWalletMeltQuoteRequest): Promise<CashuWalletMeltQuoteRecord> {
		const method = this.findMethod(request.method);
		if (!request.max && method.amount === 'required' && request.amount === null) {
			throw walletError(`An amount is required for ${request.method}`);
		}
		if ((request.max || request.amount !== null) && !method.takesAmountIn(request.unit)) {
			throw walletError(`Can't set a ${request.method} amount in ${request.unit}`);
		}
		await this.cashuWalletMintService.findWalletMint(request.user_id, request.mint_id);
		const [wallet, ready] = await Promise.all([
			this.cashuWalletMintService.getWallet(request.mint_id, request.unit),
			this.cashuWalletProofService.getReadyProofs(request.user_id, request.mint_id, request.unit),
		]);
		const pay_to = request.request.trim();
		const quote = request.max ? await this.quoteMax(wallet, method, pay_to, ready) : await method.quote(wallet, pay_to, request.amount);
		const {reserves, ...terms} = quote;
		return {
			...terms,
			balance: sumProofs(ready).toNumber(),
			fees: reserves.map(({fee_reserve, ...way}) => ({...way, ...estimateFee(wallet, ready, quote.amount, fee_reserve)})),
		};
	}

	/** A melt quote for the most the ready proofs pay at the highest reserve, capped at the method's limit; re-quotes while a smaller amount shrinks the reserve, unless the mint sets the amount */
	private async quoteMax(
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		request: string,
		ready: Proof[],
	): Promise<CashuWalletMeltQuote> {
		let amount = Math.min(wallet.maxSpendableAfterFees(ready).toNumber(), method.maxAmount(wallet.getMintInfo(), wallet.unit));
		for (let attempt = 1; ; attempt++) {
			if (amount <= 0) throw walletError('Not enough here to cover the fees');
			const quote = await method.quote(wallet, request, amount);
			const reserve = Math.max(...quote.reserves.map(({fee_reserve}) => fee_reserve));
			const fitting = wallet.maxSpendableAfterFees(ready, reserve).toNumber();
			if (quote.amount <= fitting || quote.amount !== amount || attempt === MAX_QUOTES) return quote;
			amount = fitting;
		}
	}

	/** The payout rules for a method, refusing one the wallet can't pay by */
	private findMethod(method: string): CashuWalletMeltQuoteMethod {
		const found = CashuWalletMeltQuoteMethod.find(method);
		if (!found) throw walletError(`Can't pay by ${method}`);
		return found;
	}
}
