/* Core Dependencies */
import {Injectable, Logger, type OnModuleDestroy} from '@nestjs/common';
import {OnEvent} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {CheckStateEnum, type Mint, type MintInfo, type RpcSubKinds, type SubscriptionCanceller, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletMintQuoteService} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {describeMintError, findMintQuoteMethod} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {
	CASHU_WALLET_FINAL_STATES,
	CASHU_WALLET_OPERATION_UPDATED,
	CASHU_WALLET_MINT_QUOTE_UPDATED,
} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import type {
	CashuWalletMintQuoteResponse,
	CashuWalletOperationUpdate,
	CashuWalletMintQuoteRecord,
	CashuWalletMintQuoteWatch,
	CashuWalletWatch,
} from '#server/modules/cashu/wallet/cashuwallet.types';

const WATCH_POLL_MS = 5_000;
const WATCH_FAST_CHECKS = 5;
const WATCH_SLOW_POLL_MS = 30_000;
const WATCH_MAX_MS = 30 * 60_000;

type WatchSocketKind = Exclude<RpcSubKinds, 'bolt11_melt_quote'>;

type WatchSubject = {kind: 'operation'; subject: CashuWalletOperation} | {kind: 'mint_quote'; subject: CashuWalletMintQuoteRecord};

type WatchTarget = WatchSubject & {
	key: string;
	viewers: number;
	started_at: number;
	settled_at: number;
	checks: number;
	notified: boolean;
	reopen: boolean;
	socket: {cancel: SubscriptionCanceller; mint: Mint} | null;
	wallet: Wallet | null;
};

@Injectable()
export class CashuWalletWatchService implements OnModuleDestroy {
	private readonly logger = new Logger(CashuWalletWatchService.name);
	/** Operations and mint quotes someone is viewing, by kind and id */
	private readonly targets = new Map<string, WatchTarget>();
	/** Subscriptions open on each mint's websocket, so the socket closes with its last */
	private readonly sockets = new Map<Mint, number>();
	private timer: NodeJS.Timeout | null = null;
	private ticking = false;

	constructor(
		private cashuWalletOperationService: CashuWalletOperationService,
		private cashuWalletRecoveryService: CashuWalletRecoveryService,
		private cashuWalletMintQuoteService: CashuWalletMintQuoteService,
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
		return {operation, release: this.follow({kind: 'operation', subject: operation})};
	}

	/** Watch one of a user's mint quotes while someone views it: the quote now, and the release for when the viewer leaves */
	public async watchMintQuote(user_id: string, quote_id: string): Promise<CashuWalletMintQuoteWatch> {
		const quote = await this.cashuWalletMintQuoteService.getQuote(user_id, quote_id);
		if (quote.final) return {quote, release: () => undefined};
		return {quote, release: this.follow({kind: 'mint_quote', subject: quote})};
	}

	/** Stop watching an operation once it's final, whatever settled it */
	@OnEvent(CASHU_WALLET_OPERATION_UPDATED)
	public onOperationUpdated(operation: CashuWalletOperationUpdate): void {
		const target = this.targets.get(this.keyOf('operation', operation.id));
		if (target && CASHU_WALLET_FINAL_STATES.has(operation.state)) this.drop(target);
	}

	/** Stop watching a mint quote once it's done receiving */
	@OnEvent(CASHU_WALLET_MINT_QUOTE_UPDATED)
	public onMintQuoteUpdated(quote: CashuWalletMintQuoteRecord): void {
		const target = this.targets.get(this.keyOf('mint_quote', quote.id));
		if (target && quote.final) this.drop(target);
	}

	/** Count a viewer of an operation or mint quote, starting its watch with the first; the release counts them out once */
	private follow(watched: WatchSubject): () => void {
		const target = this.targets.get(this.keyOf(watched.kind, watched.subject.id)) ?? this.addTarget(watched);
		target.viewers++;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			target.viewers--;
			if (target.viewers === 0) this.drop(target);
		};
	}

	/** Start watching: settle it now, then each tick it's due and on each websocket notification */
	private addTarget(watched: WatchSubject): WatchTarget {
		const now = Date.now();
		const target: WatchTarget = {
			...watched,
			key: this.keyOf(watched.kind, watched.subject.id),
			viewers: 0,
			started_at: now,
			settled_at: now,
			checks: 0,
			notified: true,
			reopen: false,
			socket: null,
			wallet: null,
		};
		this.targets.set(target.key, target);
		this.timer ??= setInterval(() => void this.tick(), WATCH_POLL_MS).unref();
		this.listen(target);
		void this.tick();
		return target;
	}

	/** Stop watching, closing its socket, and the tick once nothing is left */
	private drop(target: WatchTarget): void {
		if (this.targets.get(target.key) !== target) return;
		this.targets.delete(target.key);
		this.closeSocket(target);
		if (this.targets.size > 0 || !this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}

	/** Key a watched operation or mint quote is kept by */
	private keyOf(kind: WatchTarget['kind'], id: string): string {
		return `${kind}:${id}`;
	}

	/* *******************************************************
		Settling
	******************************************************** */

	/** Settle the watched operations and mint quotes that are due, one tick at a time, reopening sockets that dropped; past 30 minutes a watch ends */
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
				if (target.reopen && !target.socket) this.listen(target);
			}
			const ids = (kind: WatchTarget['kind']) => due.filter((target) => target.kind === kind).map((target) => target.subject.id);
			const warn = (error: unknown) => this.logger.warn(`Watched wallet items could not be settled: ${describeMintError(error)}`);
			await Promise.all([
				this.cashuWalletRecoveryService.settleOperations(ids('operation')).catch(warn),
				this.cashuWalletMintQuoteService.settleQuotes(ids('mint_quote')).catch(warn),
			]);
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

	/** Settle a watched target now, on a websocket notification */
	private notify(target: WatchTarget): void {
		target.notified = true;
		void this.tick();
	}

	/** Settle a watched mint quote from the update its mint pushed, so nothing is asked of the mint again; the safety poll counts from here */
	private settlePush(target: WatchTarget, update: CashuWalletMintQuoteResponse): void {
		const quote_id = target.subject.id;
		target.settled_at = Date.now();
		this.cashuWalletMintQuoteService
			.settleUpdate(quote_id, update)
			.catch((error) => this.logger.warn(`Watched wallet mint quote ${quote_id} could not be settled: ${describeMintError(error)}`));
	}

	/* *******************************************************
		Sockets
	******************************************************** */

	/** Try the target's mint websocket in the background; a socket that can't open leaves it polling */
	private listen(target: WatchTarget): void {
		target.reopen = false;
		this.openSocket(target).catch((error) =>
			this.logger.debug(`Watch socket for ${target.key} could not open: ${describeMintError(error)}`),
		);
	}

	/** Listen on the target's mint websocket (NUT-17) when the mint offers it and Orchard may reach it; a reopen reuses the wallet it first opened with */
	private async openSocket(target: WatchTarget): Promise<void> {
		const kind = this.socketKind(target);
		if (!kind) return;
		const wallet = target.wallet ?? (await this.socketWallet(target, kind));
		if (!wallet) return;
		target.wallet = wallet;
		const cancel = await this.subscribe(wallet, kind, target);
		if (!cancel) return;
		target.socket = {cancel, mint: wallet.mint};
		this.sockets.set(wallet.mint, (this.sockets.get(wallet.mint) ?? 0) + 1);
		if (this.targets.get(target.key) !== target) this.closeSocket(target);
	}

	/** The wallet to open a target's socket with, when Orchard may reach its mint that way and the mint offers the subscription */
	private async socketWallet(target: WatchTarget, kind: WatchSocketKind): Promise<Wallet | null> {
		const {user_id, mint_id, unit} = target.subject;
		if (!(await this.cashuWalletMintService.allowsSocket(user_id, mint_id))) return null;
		const wallet = await this.cashuWalletMintService.getWallet(mint_id, unit);
		return this.offersSocket(wallet.getMintInfo(), kind, target) ? wallet : null;
	}

	/** Subscribe to a mint quote, settled from each update the mint pushes, or a sent token's proofs, settled once one is spent; a lost socket polls until it reopens when next due */
	private async subscribe(wallet: Wallet, kind: WatchSocketKind, target: WatchTarget): Promise<SubscriptionCanceller | null> {
		const lost = () => {
			this.closeSocket(target);
			target.reopen = true;
		};
		if (kind === 'bolt11_mint_quote') {
			return wallet.on.mintQuoteUpdates([target.subject.quote_id!], (update) => this.settlePush(target, update), lost);
		}
		const held = await this.cashuWalletProofService.getHeldProofs(target.subject.id);
		if (held.length === 0) return null;
		return wallet.on.proofStateUpdates(
			held,
			(proof) => {
				if (proof.state === CheckStateEnum.SPENT) this.notify(target);
			},
			lost,
		);
	}

	/** Cancel a target's socket subscription, closing the mint's socket with its last */
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

	/** The NUT-17 subscription a target can be watched with: its mint quote's method's, or a sent token's proofs */
	private socketKind(target: WatchTarget): WatchSocketKind | null {
		if (target.kind === 'mint_quote') return findMintQuoteMethod(target.subject.method)?.socket_kind ?? null;
		const operation = target.subject;
		return operation.type === WalletOperationType.SEND && operation.state === WalletOperationState.PENDING ? 'proof_state' : null;
	}

	/** Whether a mint offers the subscription for the target's unit and method (NUT-17) */
	private offersSocket(info: MintInfo, kind: WatchSocketKind, target: WatchTarget): boolean {
		const {unit, method} = target.subject;
		return (info.isSupported(17).params ?? []).some(
			(entry) => entry.unit === unit && entry.commands.includes(kind) && (kind === 'proof_state' || entry.method === method),
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
