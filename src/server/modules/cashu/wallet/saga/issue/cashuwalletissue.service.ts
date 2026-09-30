/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {MintQuoteState, StaleKeysetError, isMintOperationError, type Wallet} from '@cashu/cashu-ts';
/* Application Dependencies */
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
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
import {describeMintError, walletError} from '../../cashuwallet.helpers.js';
import {classifyMintError} from '../cashuwalletsaga.helpers.js';
import {assessMintQuote, deriveQuoteKey} from './cashuwalletissue.helpers.js';
import type {CashuWalletIssueRequest, CashuWalletMintQuote, CashuWalletMintRequest} from '../../cashuwallet.types.js';

const QUOTE_KEY_COUNTER = 'nut20';

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

	/** Journal a mint operation: reserve counters and persist its exact outputs before the mint is contacted */
	public async createMintOperation(request: CashuWalletMintRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getWallet(request.mint_id, request.unit);
		const outputs = await this.cashuWalletJournalService.createOutputs(request.user_id, wallet, request.amount);
		const now = DateTime.now().toUnixInteger();
		return this.walletOperationRepository.save(
			this.walletOperationRepository.create({
				...request,
				type: WalletOperationType.MINT,
				state: WalletOperationState.PENDING,
				outputs: this.cashuWalletJournalService.serializeOutputs(outputs),
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
		return this.cashuWalletMintService.getWallet(executing.mint_id, executing.unit).then(
			(wallet) => this.attemptMint(executing, wallet, true),
			(error) => this.wait(executing, error),
		);
	}

	/** Resume an open mint operation: pending ones settle against their quote, executing ones replay or restore */
	public resume(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		return operation.state === WalletOperationState.PENDING ? this.settlePending(operation) : this.executeMintOperation(operation.id);
	}

	/** Mint once the quote is paid; fail once it expires with nothing paid or the mint rejects it outright */
	private async settlePending(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		let quote: CashuWalletMintQuote;
		try {
			const wallet = await this.cashuWalletMintService.getWallet(operation.mint_id, operation.unit);
			quote = await wallet.checkMintQuote<CashuWalletMintQuote>(operation.method!, operation.quote_id!);
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
		return operation.error
			? this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {error: null})
			: operation;
	}

	/* *******************************************************
		Issuance
	******************************************************** */

	/** Issue ecash on the Orchard mint without a payment: journal a fresh bolt11 quote, force it paid over the mint RPC, then mint */
	public async issueEcash(request: CashuWalletIssueRequest): Promise<CashuWalletOperation> {
		const mint = await this.cashuWalletMintService.getOrchardMint(request.user_id);
		const operation = await this.createIssueOperation(mint.id, request).catch((error) => {
			throw walletError(`The Orchard mint could not start the issue: ${describeMintError(error)}`);
		});
		try {
			await this.cashuMintRpcService.updateNut04Quote({quote_id: operation.quote_id!, state: MintQuoteState.PAID});
		} catch (error) {
			const reason = `Mint RPC could not mark the quote paid: ${describeMintError(error)}`;
			await this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {error: reason});
			throw walletError(reason);
		}
		return this.executeMintOperation(operation.id);
	}

	/** Journal an issue on a fresh bolt11 quote, locked to a seed-derived key (NUT-20) when the mint supports it */
	private async createIssueOperation(mint_id: string, request: CashuWalletIssueRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getWallet(mint_id, request.unit);
		const locked = wallet.getMintInfo().isSupported(20).supported;
		const quote_counter = locked ? await this.cashuWalletJournalService.reserveCounters(request.user_id, QUOTE_KEY_COUNTER, 1) : null;
		const quote =
			quote_counter === null
				? await wallet.createMintQuoteBolt11(request.amount)
				: await wallet.createLockedMintQuote(request.amount, (await this.getQuoteKey(request.user_id, quote_counter)).pubkey);
		return this.createMintOperation({...request, mint_id, method: 'bolt11', quote_id: quote.quote, quote_counter});
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/** Send the saved outputs to the mint, applying the spec-driven action if it fails */
	private async attemptMint(operation: CashuWalletOperation, wallet: Wallet, allow_rebuild: boolean): Promise<CashuWalletOperation> {
		try {
			const outputs = this.cashuWalletJournalService.deserializeOutputs(operation.outputs);
			const privkey =
				operation.quote_counter === null ? undefined : (await this.getQuoteKey(operation.user_id, operation.quote_counter)).privkey;
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

	/** Route a failed mint call to fail, restore, rebuild or wait */
	private handleFailure(
		operation: CashuWalletOperation,
		wallet: Wallet,
		error: unknown,
		allow_rebuild: boolean,
	): Promise<CashuWalletOperation> {
		const action = classifyMintError(error);
		if (action === WalletErrorAction.FAIL) {
			return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {error: describeMintError(error)});
		}
		if (action === WalletErrorAction.RESTORE) {
			return this.cashuWalletJournalService.restore(operation, wallet).then(
				(proofs) =>
					proofs.length > 0
						? this.cashuWalletJournalService.finalize(operation, proofs)
						: this.settleUnrestored(operation, error),
				(restore_error) => this.wait(operation, restore_error),
			);
		}
		if (action === WalletErrorAction.REBUILD && allow_rebuild) return this.rebuild(operation, wallet, error);
		if (hasMintCode(error, CashuMintErrorCode.QUOTE_NOT_PAID)) {
			return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {error: describeMintError(error)});
		}
		return this.wait(operation, error);
	}

	/** Nothing to restore: a quote issued to other outputs is final, anything else is retried */
	private settleUnrestored(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		if (!hasMintCode(error, CashuMintErrorCode.QUOTE_ALREADY_ISSUED)) return this.wait(operation, error);
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {
			error: 'Mint quote was issued to other outputs',
		});
	}

	/** The mint signed nothing on a stale keyset: rebuild outputs on fresh counters and try once more */
	private async rebuild(operation: CashuWalletOperation, wallet: Wallet, error: unknown): Promise<CashuWalletOperation> {
		if (!(error instanceof StaleKeysetError && error.repaired)) {
			await wallet.loadMint(true).finally(() => this.cashuWalletMintService.saveKeychain(wallet.keyChain.cache));
		}
		const outputs = await this.cashuWalletJournalService.createOutputs(operation.user_id, wallet, operation.amount);
		const rebuilt = await this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, {
			outputs: this.cashuWalletJournalService.serializeOutputs(outputs),
		});
		return this.attemptMint(rebuilt, wallet, false);
	}

	/** Keep the operation executing with the failure recorded; reconciliation retries it */
	private wait(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, {error: describeMintError(error)});
	}

	/** Keypair (hex) that locks and signs for a NUT-20 locked quote */
	private async getQuoteKey(user_id: string, counter: number): Promise<{privkey: string; pubkey: string}> {
		return deriveQuoteKey(await this.cashuWalletSeedService.getSeed(user_id), counter);
	}
}
