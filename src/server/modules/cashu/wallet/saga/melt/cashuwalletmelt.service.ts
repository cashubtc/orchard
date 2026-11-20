/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	MeltQuoteState,
	deserializeProofs,
	serializeProofs,
	sumProofs,
	type MeltPreview,
	type OperationCounters,
	type Proof,
	type Wallet,
} from '@cashu/cashu-ts';
/* Native Dependencies */
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {CashuWalletChainService} from '#server/modules/cashu/wallet/chain/cashuwalletchain.service';
import {WalletErrorAction, WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {classifyMintError, describeMintError, walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import {estimateFee} from '#server/modules/cashu/wallet/helpers/cashuwalletfee.helpers';
import {quoteExpiry} from '#server/modules/cashu/wallet/helpers/cashuwalletquote.helpers';
import {CashuWalletMeltQuoteMethod} from '#server/modules/cashu/wallet/classes/cashu-wallet-melt-quote-method.class';
import {CASHU_WALLET_OPEN_STATES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import type {
	CashuWalletMeltQuote,
	CashuWalletMeltQuoteRecord,
	CashuWalletMeltQuoteRequest,
	CashuWalletMeltQuoteResponse,
	CashuWalletMeltRequest,
} from '#server/modules/cashu/wallet/cashuwallet.types';

const MAX_QUOTES = 3;

@Injectable()
export class CashuWalletMeltService {
	/** Melts whose one attempt is still on its way to the mint, which a resume leaves alone */
	private readonly attempting = new Set<string>();

	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletJournalService: CashuWalletJournalService,
		private cashuWalletMintService: CashuWalletMintService,
		private cashuWalletProofService: CashuWalletProofService,
		private cashuWalletChainService: CashuWalletChainService,
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

	/* *******************************************************
		Pay
	******************************************************** */

	/** Pay a melt quote from a user's wallet: re-check it at the mint, lock the proofs it spends with its change outputs saved, then melt once */
	public async payQuote(request: CashuWalletMeltRequest): Promise<CashuWalletOperation> {
		const {user_id, mint_id, unit} = request;
		const method = this.findMethod(request.method);
		await this.cashuWalletMintService.findWalletMint(user_id, mint_id);
		const wallet = await this.cashuWalletMintService.getUserWallet(user_id, mint_id, unit);
		const quote = await this.checkPayable(wallet, method, request);
		const reserve = method.reserve(quote, request.fee_index);
		const {operation, preview} = await this.cashuWalletProofService.withReadyProofs(user_id, mint_id, unit, async (ready) => {
			await this.refuseOpenAttempt(request, quote);
			const total = quote.amount.toNumber() + reserve;
			const {send} = wallet.selectProofsToSend(ready, total, true);
			if (send.length === 0) throw walletError(`Not enough here to pay ${total} ${unit}`);
			const counters: OperationCounters[] = [];
			const prepared = await wallet.prepareMelt(
				method.method,
				quote,
				send,
				{onCountersReserved: (range) => counters.push(range)},
				{type: 'deterministic', counter: 0},
			);
			const journaled = this.journal(request, quote, reserve, prepared, counters);
			return {operation: await this.cashuWalletJournalService.open(journaled, prepared.inputs), preview: prepared};
		});
		this.attempting.add(operation.id);
		return this.attemptMelt(operation, wallet, method, preview).finally(() => this.attempting.delete(operation.id));
	}

	/** The quote as the mint has it now, refusing one in another unit, already paid or being paid, or expired */
	private async checkPayable(
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		request: CashuWalletMeltRequest,
	): Promise<CashuWalletMeltQuoteResponse> {
		const quote = await method.check(wallet, request.quote_id);
		if (quote.unit && quote.unit !== request.unit) throw walletError(`Melt quote is in ${quote.unit}, not ${request.unit}`);
		if (quote.state === MeltQuoteState.PAID) throw walletError('Melt quote already paid');
		if (quote.state === MeltQuoteState.PENDING) throw walletError('Melt quote is being paid');
		const expiry = quoteExpiry(quote);
		if (expiry !== null && expiry <= DateTime.now().toUnixInteger()) throw walletError('Melt quote expired; get a new one');
		return quote;
	}

	/** Refuse paying a quote or request while an earlier payment of it is open, which the quote's shared state would settle wrongly */
	private async refuseOpenAttempt(request: CashuWalletMeltRequest, quote: CashuWalletMeltQuoteResponse): Promise<void> {
		const open = {
			user_id: request.user_id,
			mint_id: request.mint_id,
			type: WalletOperationType.MELT,
			state: In(CASHU_WALLET_OPEN_STATES),
		};
		const paying = await this.walletOperationRepository.existsBy([
			{...open, quote_id: quote.quote},
			{...open, request: quote.request},
		]);
		if (paying) throw walletError('Already paying this request');
	}

	/** A new melt operation, executing once saved, with the inputs and change outputs cashu-ts prepared and the counters it restores from */
	private journal(
		request: CashuWalletMeltRequest,
		quote: CashuWalletMeltQuoteResponse,
		fee_reserve: number,
		preview: MeltPreview<CashuWalletMeltQuoteResponse>,
		counters: OperationCounters[],
	): CashuWalletOperation {
		const now = DateTime.now().toUnixInteger();
		return this.walletOperationRepository.create({
			user_id: request.user_id,
			mint_id: request.mint_id,
			type: WalletOperationType.MELT,
			state: WalletOperationState.EXECUTING,
			method: request.method,
			unit: request.unit,
			amount: quote.amount.toNumber(),
			quote_id: quote.quote,
			request: quote.request,
			expiry: quoteExpiry(quote),
			fee_reserve,
			fee_index: request.fee_index,
			preview: this.cashuWalletJournalService.serializeOutputs(preview.outputData),
			counters: JSON.stringify(counters),
			inputs: JSON.stringify(serializeProofs(preview.inputs)),
			created_at: now,
			updated_at: now,
		});
	}

	/* *******************************************************
		Settle
	******************************************************** */

	/** Resume an open melt from its quote's state, leaving one still on its way to the mint alone; a melt is never sent twice */
	public resume(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		if (this.attempting.has(operation.id)) return Promise.resolve(operation);
		const method = this.findMethod(operation.method!);
		return this.cashuWalletMintService.getWallet(operation.mint_id, operation.unit).then(
			(wallet) => this.recheck(operation, wallet, method),
			(error) => this.cashuWalletJournalService.wait(operation, error),
		);
	}

	/** Send the melt once and settle by the mint's answer: a first attempt never sent fails at once, any other failure goes by the quote */
	private attemptMelt(
		operation: CashuWalletOperation,
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		preview: MeltPreview<CashuWalletMeltQuoteResponse>,
	): Promise<CashuWalletOperation> {
		return wallet.completeMelt(preview, undefined, method.meltOptions(operation.fee_index)).then(
			({quote, change}) =>
				quote.state === MeltQuoteState.PAID && change.length > 0
					? this.finish(operation, method, quote, change)
					: this.settle(operation, wallet, method, quote),
			(error) => {
				if (classifyMintError(error, true) !== WalletErrorAction.UNSENT) return this.recheck(operation, wallet, method, error);
				return this.cashuWalletJournalService.fail(operation, describeMintError(error));
			},
		);
	}

	/** Settle by the quote as the mint has it now; while it can't be checked the operation stays as it is */
	private recheck(
		operation: CashuWalletOperation,
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		error?: unknown,
	): Promise<CashuWalletOperation> {
		return method.check(wallet, operation.quote_id!).then(
			(quote) => this.settle(operation, wallet, method, quote, error),
			(check_error) => this.cashuWalletJournalService.wait(operation, error ?? check_error),
		);
	}

	/** Paid finishes with its change, pending waits on the mint, unpaid gives back what the mint didn't take */
	private settle(
		operation: CashuWalletOperation,
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		quote: CashuWalletMeltQuoteResponse,
		error?: unknown,
	): Promise<CashuWalletOperation> {
		if (quote.state === MeltQuoteState.PAID) return this.paid(operation, wallet, method, quote);
		if (quote.state === MeltQuoteState.PENDING) return this.pending(operation, method, quote);
		return this.unpaid(operation, wallet, error);
	}

	/** A melt the mint is still paying, with how far its onchain payment has confirmed when Orchard's node can tell */
	private async pending(
		operation: CashuWalletOperation,
		method: CashuWalletMeltQuoteMethod,
		quote: CashuWalletMeltQuoteResponse,
	): Promise<CashuWalletOperation> {
		const payment_proof = method.paymentProof(quote);
		const confirmations =
			method.tracks_chain && payment_proof
				? await this.cashuWalletChainService.confirmations(payment_proof, operation.confirmations)
				: null;
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {
			error: null,
			payment_proof,
			confirmations,
		});
	}

	/** Finish a paid melt with the change the mint signed on its saved outputs, restored from the seed when the signatures can't be read */
	private paid(
		operation: CashuWalletOperation,
		wallet: Wallet,
		method: CashuWalletMeltQuoteMethod,
		quote: CashuWalletMeltQuoteResponse,
	): Promise<CashuWalletOperation> {
		const change = this.readChange(operation, wallet, quote);
		if (change) return this.finish(operation, method, quote, change);
		const finish = (proofs: Proof[]) => this.finish(operation, method, quote, proofs);
		return this.cashuWalletMintService.getUserWallet(operation.user_id, operation.mint_id, operation.unit).then(
			(seeded) => this.cashuWalletJournalService.restoreOr(operation, seeded, finish, () => finish([]), true),
			(error) => this.cashuWalletJournalService.wait(operation, error),
		);
	}

	/** Change from the quote's signatures on the saved outputs, paired by position; null when it carries none or they can't be built */
	private readChange(operation: CashuWalletOperation, wallet: Wallet, quote: CashuWalletMeltQuoteResponse): Proof[] | null {
		if (!quote.change?.length) return null;
		try {
			return wallet.createMeltChangeProofs(this.cashuWalletJournalService.deserializeOutputs(operation.preview), quote.change);
		} catch {
			return null;
		}
	}

	/** Finalize a paid melt with its change: the fee is what the inputs held beyond the amount and the change */
	private finish(
		operation: CashuWalletOperation,
		method: CashuWalletMeltQuoteMethod,
		quote: CashuWalletMeltQuoteResponse,
		change: Proof[],
	): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.finalize(operation, change, {
			fee: sumProofs(this.readInputs(operation)).subtract(operation.amount).subtract(sumProofs(change)).toNumber(),
			payment_proof: method.paymentProof(quote),
		});
	}

	/** An unpaid melt: inputs the mint still holds wait on it, otherwise they come back and the melt fails with the mint's reason */
	private async unpaid(operation: CashuWalletOperation, wallet: Wallet, error?: unknown): Promise<CashuWalletOperation> {
		const states = await this.cashuWalletJournalService.checkInputs(wallet, this.readInputs(operation));
		if (!states || states.pending.length > 0) {
			return this.cashuWalletJournalService.wait(operation, error ?? 'Mint still holds the payment');
		}
		const reason = error === undefined ? 'Payment failed' : describeMintError(error);
		return this.cashuWalletJournalService.fail(operation, reason, states.spent);
	}

	/** The proofs a melt spends, as saved before the mint was asked */
	private readInputs(operation: CashuWalletOperation): Proof[] {
		return deserializeProofs(JSON.parse(operation.inputs!) as string[]);
	}
}
