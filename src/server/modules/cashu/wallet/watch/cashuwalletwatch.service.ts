/* Core Dependencies */
import {Injectable, Logger, type OnModuleDestroy} from '@nestjs/common';
import {OnEvent} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {
	CheckStateEnum,
	MintQuoteState,
	type Mint,
	type MintInfo,
	type RpcSubKinds,
	type SubscriptionCanceller,
	type Wallet,
} from '@cashu/cashu-ts';
/* Native Dependencies */
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {describeMintError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {CASHU_WALLET_FINAL_STATES, CASHU_WALLET_OPERATION_UPDATED} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import type {CashuWalletOperationUpdate, CashuWalletWatch} from '#server/modules/cashu/wallet/cashuwallet.types';

const WATCH_POLL_MS = 5_000;
const WATCH_FAST_CHECKS = 5;
const WATCH_SLOW_POLL_MS = 30_000;
const WATCH_MAX_MS = 30 * 60_000;

type WatchSocketKind = Exclude<RpcSubKinds, 'bolt11_melt_quote'>;

type WatchTarget = {
	operation_id: string;
	viewers: number;
	started_at: number;
	settled_at: number;
	checks: number;
	notified: boolean;
	socket: {cancel: SubscriptionCanceller; mint: Mint} | null;
};

@Injectable()
export class CashuWalletWatchService implements OnModuleDestroy {
	private readonly logger = new Logger(CashuWalletWatchService.name);
	/** Operations someone is viewing, by id */
	private readonly targets = new Map<string, WatchTarget>();
	/** Subscriptions open on each mint's websocket, so the socket closes with its last */
	private readonly sockets = new Map<Mint, number>();
	private timer: NodeJS.Timeout | null = null;
	private ticking = false;

	constructor(
		private cashuWalletOperationService: CashuWalletOperationService,
		private cashuWalletRecoveryService: CashuWalletRecoveryService,
		private cashuWalletMintService: CashuWalletMintService,
		private cashuWalletProofService: CashuWalletProofService,
	) {}

	/* *******************************************************
		Watch
	******************************************************** */

	/** Watch one of a user's operations while someone views it: its state now, and the release for when the viewer leaves */
	public async watch(user_id: string, operation_id: string): Promise<CashuWalletWatch> {
		const operation = await this.cashuWalletOperationService.getOperation(user_id, operation_id);
		if (CASHU_WALLET_FINAL_STATES.has(operation.state)) return {operation, release: () => undefined};
		const target = this.targets.get(operation.id) ?? this.addTarget(operation);
		target.viewers++;
		let released = false;
		const release = () => {
			if (released) return;
			released = true;
			target.viewers--;
			if (target.viewers === 0) this.drop(target);
		};
		return {operation, release};
	}

	/** Stop watching an operation once it's final, whatever settled it */
	@OnEvent(CASHU_WALLET_OPERATION_UPDATED)
	public onOperationUpdated(operation: CashuWalletOperationUpdate): void {
		const target = this.targets.get(operation.id);
		if (target && CASHU_WALLET_FINAL_STATES.has(operation.state)) this.drop(target);
	}

	/** Start watching an operation: settle it now, then each tick it's due and on each websocket notification */
	private addTarget(operation: CashuWalletOperation): WatchTarget {
		const now = Date.now();
		const target: WatchTarget = {
			operation_id: operation.id,
			viewers: 0,
			started_at: now,
			settled_at: now,
			checks: 0,
			notified: true,
			socket: null,
		};
		this.targets.set(operation.id, target);
		this.timer ??= setInterval(() => void this.tick(), WATCH_POLL_MS).unref();
		void this.openSocket(target, operation).catch((error) =>
			this.logger.debug(`Watch socket for ${operation.id} could not open: ${describeMintError(error)}`),
		);
		void this.tick();
		return target;
	}

	/** Stop watching an operation, closing its socket, and the tick once nothing is left */
	private drop(target: WatchTarget): void {
		if (this.targets.get(target.operation_id) !== target) return;
		this.targets.delete(target.operation_id);
		this.closeSocket(target);
		if (this.targets.size > 0 || !this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}

	/* *******************************************************
		Settling
	******************************************************** */

	/** Settle the watched operations that are due through their sagas, one tick at a time; past 30 minutes a watch ends */
	private async tick(): Promise<void> {
		if (this.ticking) return;
		this.ticking = true;
		try {
			const now = Date.now();
			for (const target of this.targets.values()) if (now - target.started_at >= WATCH_MAX_MS) this.drop(target);
			const due = [...this.targets.values()].filter((target) => this.isDue(target, now));
			if (due.length === 0) return;
			for (const target of due) {
				target.notified = false;
				target.settled_at = now;
				target.checks++;
			}
			await this.cashuWalletRecoveryService.settleOperations(due.map((target) => target.operation_id));
		} catch (error) {
			this.logger.warn(`Watched wallet operations could not be settled: ${describeMintError(error)}`);
		} finally {
			this.ticking = false;
		}
	}

	/** Due when notified, or once its interval has passed since its last check */
	private isDue(target: WatchTarget, now: number): boolean {
		return target.notified || now - target.settled_at >= this.interval(target);
	}

	/** 30s on a socket; otherwise 5s for the first five checks, then doubling up to 30s, so a long watch costs a mint little */
	private interval(target: WatchTarget): number {
		if (target.socket) return WATCH_SLOW_POLL_MS;
		return Math.min(WATCH_POLL_MS * 2 ** Math.max(0, target.checks - WATCH_FAST_CHECKS + 1), WATCH_SLOW_POLL_MS);
	}

	/** Settle a watched operation now, on a websocket notification */
	private notify(target: WatchTarget): void {
		target.notified = true;
		void this.tick();
	}

	/* *******************************************************
		Sockets
	******************************************************** */

	/** Listen for the operation on its mint's websocket (NUT-17) when the mint offers it and Orchard may reach it */
	private async openSocket(target: WatchTarget, operation: CashuWalletOperation): Promise<void> {
		const kind = this.socketKind(operation);
		if (!kind || !(await this.cashuWalletMintService.allowsSocket(operation.user_id, operation.mint_id))) return;
		const wallet = await this.cashuWalletMintService.getWallet(operation.mint_id, operation.unit);
		if (!this.offersSocket(wallet.getMintInfo(), kind, operation)) return;
		const cancel = await this.subscribe(wallet, kind, operation, target);
		if (!cancel) return;
		target.socket = {cancel, mint: wallet.mint};
		this.sockets.set(wallet.mint, (this.sockets.get(wallet.mint) ?? 0) + 1);
		if (this.targets.get(target.operation_id) !== target) this.closeSocket(target);
	}

	/** Subscribe to the operation's quote, or its token's proofs; a paid quote or a spent proof settles it and a lost socket falls back to polling */
	private async subscribe(
		wallet: Wallet,
		kind: WatchSocketKind,
		operation: CashuWalletOperation,
		target: WatchTarget,
	): Promise<SubscriptionCanceller | null> {
		const lost = () => this.closeSocket(target);
		if (kind === 'bolt11_mint_quote') {
			return wallet.on.mintQuoteUpdates(
				[operation.quote_id!],
				(quote) => {
					if (quote.state !== MintQuoteState.UNPAID) this.notify(target);
				},
				lost,
			);
		}
		const held = await this.cashuWalletProofService.getHeldProofs(operation.id);
		if (held.length === 0) return null;
		return wallet.on.proofStateUpdates(
			held,
			(proof) => {
				if (proof.state === CheckStateEnum.SPENT) this.notify(target);
			},
			lost,
		);
	}

	/** Cancel a watched operation's socket subscription, closing the mint's socket with its last */
	private closeSocket(target: WatchTarget): void {
		const socket = target.socket;
		if (!socket) return;
		target.socket = null;
		socket.cancel();
		const open = (this.sockets.get(socket.mint) ?? 1) - 1;
		if (open > 0) {
			this.sockets.set(socket.mint, open);
			return;
		}
		this.sockets.delete(socket.mint);
		socket.mint.disconnectWebSocket();
	}

	/** The NUT-17 subscription an operation can be watched with: its bolt11 mint quote, or a sent token's proofs */
	private socketKind(operation: CashuWalletOperation): WatchSocketKind | null {
		if (operation.state !== WalletOperationState.PENDING) return null;
		if (operation.type === WalletOperationType.SEND) return 'proof_state';
		const minting = operation.type === WalletOperationType.MINT || operation.type === WalletOperationType.ISSUE;
		return minting && operation.method === 'bolt11' && operation.quote_id ? 'bolt11_mint_quote' : null;
	}

	/** Whether a mint offers the subscription for the operation's unit and method (NUT-17) */
	private offersSocket(info: MintInfo, kind: WatchSocketKind, operation: CashuWalletOperation): boolean {
		return (info.isSupported(17).params ?? []).some(
			(entry) =>
				entry.unit === operation.unit &&
				entry.commands.includes(kind) &&
				(kind === 'proof_state' || entry.method === operation.method),
		);
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	/** Stop every watch, closing its socket, on shutdown */
	onModuleDestroy(): void {
		for (const target of [...this.targets.values()]) this.drop(target);
	}
}
