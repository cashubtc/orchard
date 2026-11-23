/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import type {BitcoinRpcOptions} from '#server/modules/bitcoin/rpc/btcrpc.types';
/* Native Dependencies */
import {chainConfirmations, parseOutpoint} from '#server/modules/cashu/wallet/helpers/cashuwalletchain.helpers';
import type {
	CashuWalletChainDeposit,
	CashuWalletDepositTrack,
	CashuWalletDepositUpdate,
} from '#server/modules/cashu/wallet/cashuwallet.types';

// A node that fails or stalls must not pass for an empty answer, nor hold up the wallet's checks
const STRICT: BitcoinRpcOptions = {strict: true, timeout_ms: 10_000};
// Full blocks are large, more so over Tor
const BLOCK_READ: BitcoinRpcOptions = {strict: true, timeout_ms: 60_000};
// A deposit the mint hasn't credited this many blocks past its count never will be, as one first seen after its address expired
const NEVER_CREDITED_BLOCKS = 144;

/** A track's deposits still in the chain, and the first block to scan for new ones */
type DepositScan = {track: CashuWalletDepositTrack; deposits: CashuWalletChainDeposit[]; from: number};

/** Onchain progress the mint doesn't report yet, read from the operator's Bitcoin Core node; display only, the mint stays the authority */
@Injectable()
export class CashuWalletChainService {
	private readonly logger = new Logger(CashuWalletChainService.name);

	constructor(private bitcoinRpcService: BitcoinRpcService) {}

	/* *******************************************************
		Payments
	******************************************************** */

	/** Confirmations of an onchain payment's output, 0 while it's in the mempool; null without a node or once the node holds no such unspent output (spent, or on another chain), and `known` while the node can't be read */
	public async confirmations(outpoint: string, known: number | null): Promise<number | null> {
		const output = parseOutpoint(outpoint);
		if (!output || !this.bitcoinRpcService.isConfigured()) return null;
		try {
			const found = await this.bitcoinRpcService.getBitcoinTxOut(output.txid, output.vout, STRICT);
			return found?.confirmations ?? null;
		} catch (error) {
			this.logger.warn(`Confirmations of onchain payment ${outpoint} could not be read: ${error.message}`);
			return known;
		}
	}

	/* *******************************************************
		Deposits
	******************************************************** */

	/** Each followed address's deposits after the blocks since it was last scanned, kept while they confirm or wait on the mint; nothing while the node can't be read */
	public async trackDeposits(tracks: CashuWalletDepositTrack[]): Promise<Map<string, CashuWalletDepositUpdate>> {
		if (tracks.length === 0 || !this.bitcoinRpcService.isConfigured()) return new Map();
		try {
			const tip = await this.bitcoinRpcService.getBitcoinBlockCount(STRICT);
			const hashes = new Map<number, Promise<string>>();
			const hashAt = (height: number): Promise<string> => {
				if (!hashes.has(height)) hashes.set(height, this.bitcoinRpcService.getBitcoinBlockHash(height, STRICT));
				return hashes.get(height)!;
			};
			const scans = await Promise.all(tracks.map((track) => this.keepInChain(track, tip, hashAt)));
			const payments = await this.readPayments(scans, tip, hashAt);
			return new Map(
				scans.map((scan) => [scan.track.id, this.settleDeposits(scan, payments.get(scan.track.request.toLowerCase()) ?? [], tip)]),
			);
		} catch (error) {
			this.logger.warn(`Onchain deposits could not be tracked: ${error.message}`);
			return new Map();
		}
	}

	/** A track's deposits still in the chain, scanning on past where it was scanned or from below a block that left the chain, but never before the blocks a deposit could still be confirming in; a block still in the chain sits below any that left it, so nothing kept is scanned again */
	private async keepInChain(
		track: CashuWalletDepositTrack,
		tip: number,
		hashAt: (height: number) => Promise<string>,
	): Promise<DepositScan> {
		const deposits: CashuWalletChainDeposit[] = [];
		// A new address has scanned nothing, so it scans every block a deposit to it could still be confirming in
		let scanned = Math.min(track.chain_height ?? -1, tip);
		for (const deposit of track.deposits) {
			if (deposit.height <= tip && (await hashAt(deposit.height)) === deposit.blockhash) deposits.push(deposit);
			else scanned = Math.min(scanned, deposit.height - 1);
		}
		return {track, deposits, from: Math.max(scanned + 1, tip - track.required + 2)};
	}

	/** Outputs paying each followed address in the blocks any track scans, by address, each block read once */
	private async readPayments(
		scans: DepositScan[],
		tip: number,
		hashAt: (height: number) => Promise<string>,
	): Promise<Map<string, Omit<CashuWalletChainDeposit, 'paid_when_credited'>[]>> {
		const payments = new Map<string, Omit<CashuWalletChainDeposit, 'paid_when_credited'>[]>(
			scans.map(({track}) => [track.request.toLowerCase(), []]),
		);
		for (let height = Math.min(...scans.map(({from}) => from)); height <= tip; height++) {
			const blockhash = await hashAt(height);
			const block = await this.bitcoinRpcService.getBitcoinBlock(blockhash, BLOCK_READ);
			for (const {txid, vout} of block.tx) {
				for (const output of vout) {
					const address = (output.scriptPubKey.address ?? output.scriptPubKey.addresses?.[0])?.toLowerCase();
					const followed = address && payments.get(address);
					if (followed) followed.push({txid, vout: output.n, amount: Math.round(output.value * 1e8), height, blockhash});
				}
			}
		}
		return payments;
	}

	/** A track's deposits with the payments to it from where it scans added, each waiting on the paid total it brings the quote to, less those the mint credited or never will */
	private settleDeposits(
		{track, deposits, from}: DepositScan,
		payments: Omit<CashuWalletChainDeposit, 'paid_when_credited'>[],
		tip: number,
	): CashuWalletDepositUpdate {
		let expected = Math.max(track.amount_paid, ...deposits.map(({paid_when_credited}) => paid_when_credited ?? 0));
		const found: CashuWalletChainDeposit[] = [];
		for (const payment of payments) {
			if (payment.height < from) continue;
			const credited = payment.amount >= track.min_amount;
			if (credited) expected += payment.amount;
			found.push({...payment, paid_when_credited: credited ? expected : null});
		}
		return {chain_height: tip, deposits: [...deposits, ...found].filter((deposit) => this.isOutstanding(deposit, track, tip))};
	}

	/** Whether a deposit is still the mint's to credit: one under its minimum until it reaches the count, any other until credited or a day past the count */
	private isOutstanding(deposit: CashuWalletChainDeposit, track: CashuWalletDepositTrack, tip: number): boolean {
		const confirmations = chainConfirmations(tip, deposit.height);
		if (deposit.paid_when_credited === null) return confirmations < track.required;
		return track.amount_paid < deposit.paid_when_credited && confirmations < track.required + NEVER_CREDITED_BLOCKS;
	}
}
