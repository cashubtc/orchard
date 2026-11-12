/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {MintQuoteState, StaleKeysetError, isMintOperationError, type OperationCounters, type Wallet} from '@cashu/cashu-ts';
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
import {classifyMintError, classifyMintRpcError} from '../cashuwalletsaga.helpers.js';
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

	/** Journal a mint operation: cashu-ts builds its outputs on reserved counters, persisted before the mint is contacted */
	public async createMintOperation(request: CashuWalletMintRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getUserWallet(request.user_id, request.mint_id, request.unit);
		const prepared = await this.prepareOutputs(wallet, request.method, request.amount, request.quote_id);
		const now = DateTime.now().toUnixInteger();
		return this.walletOperationRepository.save(
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
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {error: null});
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
			// A refusal is final; any other failure may have applied, so reconciliation settles it against the quote
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

	/** Journal an issue on a fresh bolt11 quote, locked to a seed-derived key (NUT-20) when the mint supports it */
	private async createIssueOperation(mint_id: string, request: CashuWalletIssueRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getWallet(mint_id, request.unit);
		const locked = wallet.getMintInfo().isSupported(20).supported;
		const quote_counter = locked
			? (await this.cashuWalletMintService.counterSource(request.user_id).reserveCursor(QUOTE_KEY_COUNTER, 1)).start
			: null;
		const quote =
			quote_counter === null
				? await wallet.createMintQuoteBolt11(request.amount)
				: await wallet.createLockedMintQuote(request.amount, (await this.getQuoteKey(request.user_id, quote_counter)).pubkey);
		return this.createMintOperation({
			...request,
			mint_id,
			type: WalletOperationType.ISSUE,
			method: 'bolt11',
			quote_id: quote.quote,
			quote_counter,
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

	/** Route a failed mint call to restore, rebuild, settle against its quote, or wait */
	private handleFailure(
		operation: CashuWalletOperation,
		wallet: Wallet,
		error: unknown,
		allow_rebuild: boolean,
	): Promise<CashuWalletOperation> {
		const action = classifyMintError(error);
		if (action === WalletErrorAction.RESTORE) return this.restoreOr(operation, wallet, () => this.settleUnrestored(operation, error));
		if (action === WalletErrorAction.REBUILD && allow_rebuild) {
			return this.restoreOr(operation, wallet, async () => {
				await this.reloadKeysets(wallet, error);
				return this.rebuild(operation, wallet);
			});
		}
		// A refusal can hide outputs the mint already signed (CDK answers 20006), so restore before the quote decides
		if (action === WalletErrorAction.FAIL || action === WalletErrorAction.CHECK_STATE) {
			return this.restoreOr(operation, wallet, () => this.pending(operation, error));
		}
		if (hasMintCode(error, CashuMintErrorCode.QUOTE_NOT_PAID)) return this.pending(operation, error);
		return this.wait(operation, error);
	}

	/** NUT-09 restore of the saved outputs, finalizing what the mint signed; `fallback` runs when it signed none, and a failed restore waits */
	private restoreOr(
		operation: CashuWalletOperation,
		wallet: Wallet,
		fallback: () => Promise<CashuWalletOperation>,
	): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.restore(operation, wallet).then(
			(proofs) => (proofs.length > 0 ? this.cashuWalletJournalService.finalize(operation, proofs) : fallback()),
			(restore_error) => this.wait(operation, restore_error),
		);
	}

	/** Nothing to restore: a quote issued to other outputs is final, anything else is retried */
	private settleUnrestored(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		if (!hasMintCode(error, CashuMintErrorCode.QUOTE_ALREADY_ISSUED)) return this.wait(operation, error);
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {
			error: 'Mint quote was issued to other outputs',
		});
	}

	/** Back to pending with the failure recorded; the quote's own state decides when the operation ends */
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

	/** Keep the operation executing with the failure recorded; reconciliation retries it */
	private wait(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, {error: describeMintError(error)});
	}

	/** Keypair (hex) that locks and signs for a NUT-20 locked quote */
	private async getQuoteKey(user_id: string, counter: number): Promise<{privkey: string; pubkey: string}> {
		return deriveQuoteKey(await this.cashuWalletSeedService.getSeed(user_id), counter);
	}
}
