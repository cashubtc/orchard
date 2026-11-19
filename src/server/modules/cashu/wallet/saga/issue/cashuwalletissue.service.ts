/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {MintQuoteState, StaleKeysetError, isMintOperationError, type OperationCounters, type Proof, type Wallet} from '@cashu/cashu-ts';
/* Application Dependencies */
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
/* Native Dependencies */
import {
	classifyMintError,
	classifyMintRpcError,
	describeMintError,
	walletError,
} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import {assessMintQuote} from '#server/modules/cashu/wallet/helpers/cashuwalletquote.helpers';
import {deriveMintQuoteKey} from '#server/modules/cashu/wallet/helpers/cashuwalletkey.helpers';
import {CashuWalletMintQuoteMethod} from '#server/modules/cashu/wallet/classes/cashu-wallet-mint-quote-method.class';
/* Local Dependencies */
import {CashuWalletOperation} from '../cashuwalletoperation.entity.js';
import {CashuWalletJournalService} from '../cashuwalletjournal.service.js';
import {CashuWalletSeedService} from '../../seed/cashuwalletseed.service.js';
import {CashuWalletMintService} from '../../mint/cashuwalletmint.service.js';
import {
	CashuMintErrorCode,
	MintQuoteProgress,
	WalletErrorAction,
	WalletOperationState,
	WalletOperationType,
} from '../../cashuwallet.enums.js';
import type {CashuWalletIssueRequest, CashuWalletMintQuoteResponse, CashuWalletMintRequest} from '../../cashuwallet.types.js';

const MINT_QUOTE_KEY_COUNTER = 'nut20';

const hasMintCode = (error: unknown, code: CashuMintErrorCode): boolean => isMintOperationError(error) && error.code === code;

@Injectable()
export class CashuWalletIssueService {
	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletJournalService: CashuWalletJournalService,
		private cashuWalletSeedService: CashuWalletSeedService,
		private cashuWalletMintService: CashuWalletMintService,
		private cashuMintRpcService: CashuMintRpcService,
	) {}

	/* *******************************************************
		Mint Operations
	******************************************************** */

	/** Journal a mint operation: cashu-ts builds its outputs on reserved counters, persisted before the mint is contacted */
	public async createMintOperation(request: CashuWalletMintRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getUserWallet(request.user_id, request.mint_id, request.unit);
		const prepared = await this.prepareOutputs(wallet, request.method, request.amount, request.quote_id);
		const now = DateTime.now().toUnixInteger();
		return this.cashuWalletJournalService.open(
			this.walletOperationRepository.create({
				...request,
				...prepared,
				state: WalletOperationState.PENDING,
				created_at: now,
				updated_at: now,
			}),
		);
	}

	/** Mint an operation's saved outputs; safe to repeat, since the mint either signs them or they are restored */
	public async executeMintOperation(operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.walletOperationRepository.findOneByOrFail({id: operation_id});
		if (operation.state === WalletOperationState.FINALIZED || operation.state === WalletOperationState.FAILED) return operation;
		const executing =
			operation.state === WalletOperationState.PENDING
				? await this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING)
				: operation;
		return this.cashuWalletMintService.getUserWallet(executing.user_id, executing.mint_id, executing.unit).then(
			(wallet) => this.attemptMint(executing, wallet, true),
			(error) => this.cashuWalletJournalService.wait(executing, error),
		);
	}

	/** Resume an open mint operation: pending ones settle against their mint quote, executing ones replay or restore */
	public resume(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		return operation.state === WalletOperationState.PENDING ? this.settlePending(operation) : this.executeMintOperation(operation.id);
	}

	/** Mint once the mint quote is paid; fail once it expires with nothing paid or the mint rejects it outright */
	private async settlePending(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		let quote: CashuWalletMintQuoteResponse;
		try {
			const wallet = await this.cashuWalletMintService.getWallet(operation.mint_id, operation.unit);
			quote = await wallet.checkMintQuote<CashuWalletMintQuoteResponse>(operation.method!, operation.quote_id!);
		} catch (error) {
			const state = classifyMintError(error) === WalletErrorAction.FAIL ? WalletOperationState.FAILED : WalletOperationState.PENDING;
			return this.cashuWalletJournalService.transition(operation, state, {error: describeMintError(error)});
		}
		const progress = assessMintQuote(quote, operation.amount, DateTime.now().toUnixInteger());
		if (progress === MintQuoteProgress.MINTABLE || progress === MintQuoteProgress.ISSUED) {
			return this.executeMintOperation(operation.id);
		}
		if (progress === MintQuoteProgress.EXPIRED) {
			return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {error: 'Mint quote expired unpaid'});
		}
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {error: null});
	}

	/* *******************************************************
		Issuance
	******************************************************** */

	/** Issue ecash on the Orchard mint without a payment: journal a fresh bolt11 mint quote, force it paid over the mint RPC, then mint */
	public async issueEcash(request: CashuWalletIssueRequest): Promise<CashuWalletOperation> {
		const mint = await this.cashuWalletMintService.getOrchardMint(request.user_id);
		const operation = await this.createIssueOperation(mint.id, request).catch((error) => {
			throw walletError(`The Orchard mint could not start the issue: ${describeMintError(error)}`);
		});
		try {
			await this.cashuMintRpcService.updateNut04Quote({quote_id: operation.quote_id!, state: MintQuoteState.PAID});
		} catch (error) {
			// A refusal is final; any other failure may have applied, so reconciliation settles it against the mint quote
			const refused = classifyMintRpcError(error) === WalletErrorAction.FAIL;
			const reason = `Mint RPC could not mark the quote paid: ${describeMintError(error)}${refused ? '' : '; the issue completes on its own if the mint applied it'}`;
			await this.cashuWalletJournalService.transition(
				operation,
				refused ? WalletOperationState.FAILED : WalletOperationState.PENDING,
				{
					error: reason,
				},
			);
			throw walletError(reason);
		}
		return this.executeMintOperation(operation.id);
	}

	/** Journal an issue on a fresh bolt11 mint quote, locked to a seed-derived key (NUT-20) when the mint supports it */
	private async createIssueOperation(mint_id: string, request: CashuWalletIssueRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getWallet(mint_id, request.unit);
		const bolt11 = CashuWalletMintQuoteMethod.find('bolt11')!;
		const key = bolt11.locks(wallet.getMintInfo()) ? await this.reserveMintQuoteKey(request.user_id) : null;
		const quote = await bolt11.create(wallet, key?.pubkey ?? null, request.amount);
		return this.createMintOperation({
			...request,
			mint_id,
			type: WalletOperationType.ISSUE,
			method: 'bolt11',
			quote_id: quote.quote,
			quote_counter: key?.counter ?? null,
		});
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/** Deterministic outputs cashu-ts builds for a mint from the user's counters, with the counter ranges they used */
	private async prepareOutputs(
		wallet: Wallet,
		method: string,
		amount: number,
		quote_id: string,
	): Promise<Pick<CashuWalletOperation, 'preview' | 'counters'>> {
		const counters: OperationCounters[] = [];
		const preview = await wallet.prepareMint(
			method,
			amount,
			{quote: quote_id},
			{onCountersReserved: (reserved) => counters.push(reserved)},
			{type: 'deterministic', counter: 0},
		);
		return {
			preview: this.cashuWalletJournalService.serializeOutputs(preview.outputData),
			counters: JSON.stringify(counters),
		};
	}

	/** Send the saved outputs to the mint, applying the spec-driven action if it fails */
	private async attemptMint(operation: CashuWalletOperation, wallet: Wallet, allow_rebuild: boolean): Promise<CashuWalletOperation> {
		try {
			const outputs = this.cashuWalletJournalService.deserializeOutputs(operation.preview);
			const privkey =
				operation.quote_counter === null
					? undefined
					: (await this.getMintQuoteKey(operation.user_id, operation.quote_counter)).privkey;
			const preview = await wallet.prepareMint(
				operation.method,
				operation.amount,
				{quote: operation.quote_id},
				{privkey},
				{type: 'custom', data: outputs},
			);
			return await this.cashuWalletJournalService.finalize(operation, await wallet.completeMint(preview));
		} catch (error) {
			return this.handleFailure(operation, wallet, error, allow_rebuild);
		}
	}

	/** Route a failed mint call to restore, rebuild, settle against its mint quote, or wait */
	private handleFailure(
		operation: CashuWalletOperation,
		wallet: Wallet,
		error: unknown,
		allow_rebuild: boolean,
	): Promise<CashuWalletOperation> {
		const action = classifyMintError(error);
		const finalize = (proofs: Proof[]) => this.cashuWalletJournalService.finalize(operation, proofs);
		if (action === WalletErrorAction.RESTORE) {
			return this.cashuWalletJournalService.restoreOr(operation, wallet, finalize, () => this.settleUnrestored(operation, error));
		}
		if (action === WalletErrorAction.REBUILD && allow_rebuild) {
			return this.cashuWalletJournalService.restoreOr(operation, wallet, finalize, async () => {
				await this.reloadKeysets(wallet, error);
				return this.rebuild(operation, wallet);
			});
		}
		// A refusal can hide outputs the mint already signed (CDK answers 20006), so restore before the mint quote decides
		if (action === WalletErrorAction.FAIL || action === WalletErrorAction.CHECK_STATE) {
			return this.cashuWalletJournalService.restoreOr(operation, wallet, finalize, () => this.pending(operation, error));
		}
		if (hasMintCode(error, CashuMintErrorCode.QUOTE_NOT_PAID)) return this.pending(operation, error);
		return this.cashuWalletJournalService.wait(operation, error);
	}

	/** Nothing to restore: a mint quote issued to other outputs is final, anything else is retried */
	private settleUnrestored(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		if (!hasMintCode(error, CashuMintErrorCode.QUOTE_ALREADY_ISSUED)) return this.cashuWalletJournalService.wait(operation, error);
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {
			error: 'Mint quote was issued to other outputs',
		});
	}

	/** Back to pending with the failure recorded; the mint quote's own state decides when the operation ends */
	private pending(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {error: describeMintError(error)});
	}

	/** Reload a stale keychain from the mint, unless cashu-ts already repaired it */
	private async reloadKeysets(wallet: Wallet, error: unknown): Promise<void> {
		if (error instanceof StaleKeysetError && error.repaired) return;
		await this.cashuWalletMintService.reloadKeychain(wallet);
	}

	/** Rebuild an operation's outputs on fresh counters and try once more */
	private async rebuild(operation: CashuWalletOperation, wallet: Wallet): Promise<CashuWalletOperation> {
		const prepared = await this.prepareOutputs(wallet, operation.method!, operation.amount, operation.quote_id!);
		const rebuilt = await this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, prepared);
		return this.attemptMint(rebuilt, wallet, false);
	}

	/** A fresh NUT-20 key from a user's seed for their next mint quote, with the counter it's derived at */
	public async reserveMintQuoteKey(user_id: string): Promise<{counter: number; pubkey: string}> {
		const {start} = await this.cashuWalletMintService.counterSource(user_id).reserveCursor(MINT_QUOTE_KEY_COUNTER, 1);
		return {counter: start, pubkey: (await this.getMintQuoteKey(user_id, start)).pubkey};
	}

	/** Keypair (hex) that locks and signs for a NUT-20 locked mint quote */
	private async getMintQuoteKey(user_id: string, counter: number): Promise<{privkey: string; pubkey: string}> {
		return deriveMintQuoteKey(await this.cashuWalletSeedService.getSeed(user_id), counter);
	}
}
