/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	OutputData,
	deserializeSwapPreview,
	getEncodedToken,
	getTokenMetadata,
	isMintOperationError,
	serializeSwapPreview,
	sumProofs,
	type OperationCounters,
	type Proof,
	type SerializedSwapPreview,
	type SwapPreview,
	type TokenMetadata,
	type Wallet,
} from '@cashu/cashu-ts';
/* Native Dependencies */
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {
	WalletErrorAction,
	WalletMintMatch,
	WalletOperationState,
	WalletOperationType,
	WalletProofState,
} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {describeMintError, walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {classifyMintError} from '#server/modules/cashu/wallet/saga/cashuwalletsaga.helpers';
import type {CashuWalletSendRequest, CashuWalletTokenPreview} from '#server/modules/cashu/wallet/cashuwallet.types';

@Injectable()
export class CashuWalletSwapService {
	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletJournalService: CashuWalletJournalService,
		private cashuWalletProofService: CashuWalletProofService,
		private cashuWalletMintService: CashuWalletMintService,
	) {}

	/* *******************************************************
		Send
	******************************************************** */

	/** Send ecash as a token: swap out the amount plus the redeemer's fee, holding the token's proofs until it's claimed or reclaimed */
	public async sendToken(request: CashuWalletSendRequest): Promise<CashuWalletOperation> {
		const {user_id, mint_id, unit, amount} = request;
		await this.cashuWalletMintService.getTokenUrl(user_id, mint_id);
		const wallet = await this.cashuWalletMintService.getUserWallet(user_id, mint_id, unit);
		const operation = await this.cashuWalletProofService.withReadyProofs(user_id, mint_id, unit, async (ready) => {
			const counters: OperationCounters[] = [];
			const preview = await wallet.ops
				.send(amount, ready)
				.includeFees()
				.asDeterministic()
				.keepAsDeterministic()
				.onCountersReserved((range) => counters.push(range))
				.prepare();
			const fee = sumProofs(preview.inputs)
				.subtract(OutputData.sumOutputAmounts(preview.keepOutputs ?? []))
				.subtract(amount);
			const journaled = this.journal({...request, type: WalletOperationType.SEND, fee: fee.toNumber()}, preview, counters);
			return this.cashuWalletJournalService.open(journaled, preview.inputs);
		});
		return this.attemptSwap(operation, wallet);
	}

	/** Check whether a sent token was claimed, finishing the send once all of it is spent */
	public async checkToken(user_id: string, operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.findSend(user_id, operation_id);
		if (operation.state !== WalletOperationState.PENDING) return operation;
		const [checked] = await this.checkSends([operation]);
		return checked;
	}

	/** Check sent tokens with one request per mint and unit; a mint that can't be asked leaves its sends waiting */
	public async checkClaims(operations: CashuWalletOperation[]): Promise<CashuWalletOperation[]> {
		const groups = new Map<string, CashuWalletOperation[]>();
		for (const operation of operations) {
			const key = `${operation.mint_id}:${operation.unit}`;
			groups.set(key, [...(groups.get(key) ?? []), operation]);
		}
		const checked = await Promise.all([...groups.values()].map((group) => this.checkSends(group).catch(() => group)));
		return checked.flat();
	}

	/** Swap what's left unclaimed of a sent token back into the wallet; one already claimed finishes the send instead */
	public async reclaimToken(user_id: string, operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.findSend(user_id, operation_id);
		if (operation.state !== WalletOperationState.PENDING) throw walletError('Only an unclaimed token can be reclaimed');
		const wallet = await this.cashuWalletMintService.getUserWallet(user_id, operation.mint_id, operation.unit);
		const {unspent, pending} = await wallet.groupProofsByState(await this.cashuWalletProofService.getHeldProofs(operation.id));
		if (pending.length > 0) throw walletError('Token is being claimed; check again shortly');
		if (unspent.length === 0) return this.claimed(operation);
		const {preview, counters} = await this.prepareReceive(wallet, unspent);
		const changes = this.swapFields(preview, counters);
		const reclaiming = await this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, changes);
		if (reclaiming.preview !== changes.preview) return reclaiming;
		return this.attemptSwap(reclaiming, wallet);
	}

	/** One state check over sends at a mint and unit, finishing each whose token is spent in full */
	private async checkSends(operations: CashuWalletOperation[]): Promise<CashuWalletOperation[]> {
		const {mint_id, unit} = operations[0];
		const wallet = await this.cashuWalletMintService.getWallet(mint_id, unit);
		const held = await Promise.all(operations.map((operation) => this.cashuWalletProofService.getHeldProofs(operation.id)));
		const {unspent, pending} = await wallet.groupProofsByState(held.flat());
		const open = new Set([...unspent, ...pending].map((proof) => proof.secret));
		return Promise.all(
			operations.map((operation, index) =>
				held[index].some((proof) => open.has(proof.secret)) ? operation : this.claimed(operation),
			),
		);
	}

	/** A send in a user's wallet */
	private async findSend(user_id: string, operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.walletOperationRepository.findOneBy({id: operation_id, user_id, type: WalletOperationType.SEND});
		if (!operation) throw walletError('Sent token not found');
		return operation;
	}

	/* *******************************************************
		Receive
	******************************************************** */

	/** What a token holds and the mint it's from; fee and claimed state once that mint is in the wallet */
	public async previewToken(user_id: string, token: string, allow_local: boolean): Promise<CashuWalletTokenPreview> {
		const encoded = token.trim();
		const metadata = this.readToken(encoded);
		const mint = await this.cashuWalletMintService.lookupMint(user_id, metadata.mint, allow_local);
		const preview: CashuWalletTokenPreview = {
			amount: metadata.amount.toNumber(),
			unit: metadata.unit,
			memo: metadata.memo ?? null,
			fee: null,
			claimed: null,
			mint,
		};
		if (mint.match !== WalletMintMatch.URL || !mint.mint_id) return preview;
		const wallet = await this.cashuWalletMintService.getWallet(mint.mint_id, metadata.unit);
		const proofs = await this.decodeProofs(wallet, encoded);
		const {unspent} = await wallet.groupProofsByState(proofs);
		return {...preview, fee: wallet.getFeesForProofs(proofs).toNumber(), claimed: unspent.length < proofs.length};
	}

	/** Receive a token by swapping its proofs for the wallet's own; a mint not in the wallet is added only with add_mint */
	public async receiveToken(user_id: string, token: string, add_mint: boolean, allow_local: boolean): Promise<CashuWalletOperation> {
		const encoded = token.trim();
		const {mint, unit, memo} = this.readToken(encoded);
		const mint_id = await this.findTokenMint(user_id, mint, add_mint, allow_local);
		const proofs = await this.decodeProofs(await this.cashuWalletMintService.getWallet(mint_id, unit), encoded);
		const wallet = await this.cashuWalletMintService.getUserWallet(user_id, mint_id, unit);
		const {preview, counters} = await this.prepareReceive(wallet, proofs);
		const operation = await this.walletOperationRepository.save(
			this.journal(
				{
					user_id,
					mint_id,
					unit,
					type: WalletOperationType.RECEIVE,
					amount: preview.amount.toNumber(),
					fee: preview.fees.toNumber(),
					memo: memo ?? null,
				},
				preview,
				counters,
			),
		);
		return this.attemptSwap(operation, wallet);
	}

	/** A token's metadata, refusing anything that isn't a token */
	private readToken(token: string): TokenMetadata {
		try {
			return getTokenMetadata(token);
		} catch (error) {
			throw walletError(`Not an ecash token: ${describeMintError(error)}`);
		}
	}

	/** The wallet mint a token is from, added only with consent; a mint with the same pubkey gains the token's URL */
	private async findTokenMint(user_id: string, mint_url: string, add_mint: boolean, allow_local: boolean): Promise<string> {
		const lookup = await this.cashuWalletMintService.lookupMint(user_id, mint_url, allow_local);
		if (lookup.match === WalletMintMatch.URL && lookup.mint_id) return lookup.mint_id;
		if (!add_mint) throw walletError(`Add ${lookup.url} to receive this token`);
		return (await this.cashuWalletMintService.addMint(user_id, mint_url, allow_local)).id;
	}

	/** A token's proofs with full keyset ids, reloading the mint's keysets once when the cached ones can't map it */
	private async decodeProofs(wallet: Wallet, token: string): Promise<Proof[]> {
		try {
			return wallet.decodeToken(token).proofs;
		} catch {
			await this.cashuWalletMintService.reloadKeychain(wallet);
			return wallet.decodeToken(token).proofs;
		}
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/** Resume an open swap: a sent token waiting to be claimed is checked, an executing swap replays or restores */
	public resume(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		if (operation.state === WalletOperationState.PENDING) return this.checkClaims([operation]).then(([checked]) => checked);
		return this.cashuWalletMintService.getUserWallet(operation.user_id, operation.mint_id, operation.unit).then(
			(wallet) => this.attemptSwap(operation, wallet),
			(error) => this.wait(operation, error),
		);
	}

	/** A new swap operation, executing once saved, with the preview it replays and the counters it restores from */
	private journal(fields: Partial<CashuWalletOperation>, preview: SwapPreview, counters: OperationCounters[]): CashuWalletOperation {
		const now = DateTime.now().toUnixInteger();
		return this.walletOperationRepository.create({
			...fields,
			...this.swapFields(preview, counters),
			method: null,
			state: WalletOperationState.EXECUTING,
			created_at: now,
			updated_at: now,
		});
	}

	/** A receive swap cashu-ts builds on the user's counters, with the counter ranges it used */
	private async prepareReceive(wallet: Wallet, proofs: Proof[]): Promise<{preview: SwapPreview; counters: OperationCounters[]}> {
		const counters: OperationCounters[] = [];
		const preview = await wallet.ops
			.receive(proofs)
			.asDeterministic()
			.onCountersReserved((range) => counters.push(range))
			.prepare();
		return {preview, counters};
	}

	/** A prepared swap in storage form */
	private swapFields(preview: SwapPreview, counters: OperationCounters[]): Pick<CashuWalletOperation, 'preview' | 'counters'> {
		return {preview: JSON.stringify(serializeSwapPreview(preview)), counters: JSON.stringify(counters)};
	}

	/** The swap an operation saved, byte-identical on replay */
	private readPreview(operation: CashuWalletOperation): SwapPreview {
		return deserializeSwapPreview(JSON.parse(operation.preview!) as SerializedSwapPreview);
	}

	/** Send the saved swap to the mint and settle it, applying the spec-driven action if it fails */
	private attemptSwap(operation: CashuWalletOperation, wallet: Wallet): Promise<CashuWalletOperation> {
		return wallet.completeSwap(this.readPreview(operation)).then(
			({keep, send}) => this.settle(operation, keep, send),
			(error) => this.handleFailure(operation, wallet, error),
		);
	}

	/** Route a failed swap: transport failures wait, refusals check the inputs, anything else restores first */
	private handleFailure(operation: CashuWalletOperation, wallet: Wallet, error: unknown): Promise<CashuWalletOperation> {
		const action = classifyMintError(error);
		if (action === WalletErrorAction.WAIT) return this.wait(operation, error);
		if (action === WalletErrorAction.FAIL) return this.checkInputs(operation, wallet, error);
		return this.cashuWalletJournalService.restore(operation, wallet).then(
			(proofs) => (proofs.length > 0 ? this.settleRestored(operation, proofs) : this.checkInputs(operation, wallet, error)),
			(restore_error) => this.wait(operation, restore_error),
		);
	}

	/** Nothing was restored, so the inputs' state decides: unspent means the swap never happened */
	private async checkInputs(operation: CashuWalletOperation, wallet: Wallet, error: unknown): Promise<CashuWalletOperation> {
		const states = await wallet.groupProofsByState(this.readPreview(operation).inputs).catch(() => null);
		if (!states || states.pending.length > 0) return this.wait(operation, error);
		if (states.unspent.length > 0) return this.refuse(operation, states.spent, error);
		return this.spentElsewhere(operation, error);
	}

	/** The mint didn't take the swap: a reclaim waits to be tried again, a send gives its inputs back, a receive fails */
	private async refuse(operation: CashuWalletOperation, spent: Proof[], error: unknown): Promise<CashuWalletOperation> {
		const reason = {error: describeMintError(error)};
		if (this.isReclaim(operation)) return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, reason);
		if (operation.type === WalletOperationType.SEND) {
			await this.cashuWalletProofService.releaseInputs(
				operation.id,
				spent.map((proof) => proof.secret),
			);
		}
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, reason);
	}

	/** Every input was spent by something else: a reclaimed token was claimed first, anything else fails with the mint's reason */
	private async spentElsewhere(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		if (this.isReclaim(operation)) return this.claimed(operation);
		const is_send = operation.type === WalletOperationType.SEND;
		if (is_send) await this.cashuWalletProofService.spendInputs(operation.id);
		const fallback = is_send ? 'Ecash already spent' : 'Token already claimed';
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FAILED, {
			error: isMintOperationError(error) ? describeMintError(error) : fallback,
		});
	}

	/** Settle from the proofs NUT-09 restored, sorted back into kept and sent by the preview's outputs */
	private settleRestored(operation: CashuWalletOperation, proofs: Proof[]): Promise<CashuWalletOperation> {
		const decoder = new TextDecoder();
		const sent = new Set((this.readPreview(operation).sendOutputs ?? []).map((output) => decoder.decode(output.secret)));
		return this.settle(
			operation,
			proofs.filter((proof) => !sent.has(proof.secret)),
			proofs.filter((proof) => sent.has(proof.secret)),
		);
	}

	/** Store a completed swap's proofs: a receive finishes, a reclaim takes the token back, a send holds its token out */
	private settle(operation: CashuWalletOperation, keep: Proof[], send: Proof[]): Promise<CashuWalletOperation> {
		if (operation.type === WalletOperationType.RECEIVE) return this.cashuWalletJournalService.finalize(operation, keep);
		return this.isReclaim(operation) ? this.settleReclaim(operation, keep) : this.settleSend(operation, keep, send);
	}

	/** Keep the change, hold the token's proofs and encode the token with the URL others reach the mint at */
	private async settleSend(operation: CashuWalletOperation, keep: Proof[], send: Proof[]): Promise<CashuWalletOperation> {
		const mint_url = await this.cashuWalletMintService.getTokenUrl(operation.user_id, operation.mint_id);
		await this.cashuWalletProofService.spendInputs(operation.id);
		await this.cashuWalletProofService.storeProofs(operation, keep);
		await this.cashuWalletProofService.storeProofs(operation, send, WalletProofState.HELD);
		const token = getEncodedToken({mint: mint_url, proofs: send, unit: operation.unit, ...(operation.memo && {memo: operation.memo})});
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.PENDING, {token, error: null});
	}

	/** Keep what the reclaim swapped back and retire the token's proofs, adding the reclaim's fee to the send's */
	private async settleReclaim(operation: CashuWalletOperation, keep: Proof[]): Promise<CashuWalletOperation> {
		await this.cashuWalletProofService.storeProofs(operation, keep);
		await this.cashuWalletProofService.spendHeldProofs(operation.id);
		const fee = (operation.fee ?? 0) + this.readPreview(operation).fees.toNumber();
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.RECLAIMED, {fee, error: null});
	}

	/** A send whose token is spent in full is finished */
	private async claimed(operation: CashuWalletOperation): Promise<CashuWalletOperation> {
		await this.cashuWalletProofService.spendHeldProofs(operation.id);
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.FINALIZED, {error: null});
	}

	/** Keep the swap executing with the failure recorded; reconciliation replays it */
	private wait(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		return this.cashuWalletJournalService.transition(operation, WalletOperationState.EXECUTING, {error: describeMintError(error)});
	}

	/** A send whose token is out, so its swap is the reclaim */
	private isReclaim(operation: CashuWalletOperation): boolean {
		return operation.type === WalletOperationType.SEND && operation.token !== null;
	}
}
