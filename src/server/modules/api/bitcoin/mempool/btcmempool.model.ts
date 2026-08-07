/* Core Dependencies */
import {Field, ID, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {BitcoinTransaction} from '#server/modules/bitcoin/rpc/btcrpc.types';

@ObjectType({description: 'Bitcoin mempool transaction fee breakdown'})
export class OrchardBitcoinMempoolFees {
	@Field(() => Float, {description: 'Base transaction fee in BTC'})
	base: number;

	@Field(() => Float, {description: 'Modified fee with fee deltas in BTC'})
	modified: number;

	@Field(() => Float, {description: 'Fee including ancestor transactions in BTC'})
	ancestor: number;

	@Field(() => Float, {description: 'Fee including descendant transactions in BTC'})
	descendant: number;

	constructor(fees: BitcoinTransaction['fees']) {
		this.base = fees.base;
		this.modified = fees.modified;
		this.ancestor = fees.ancestor;
		this.descendant = fees.descendant;
	}
}

@ObjectType({description: 'Bitcoin mempool transaction data'})
export class OrchardBitcoinMempoolTransaction {
	@Field(() => ID, {description: 'Transaction identifier'})
	txid: string;

	@Field(() => Int, {description: 'Virtual transaction size in vbytes'})
	vsize: number;

	@Field(() => Int, {description: 'Transaction weight in weight units'})
	weight: number;

	@Field(() => UnixTimestamp, {description: 'Time the transaction entered the mempool'})
	time: number;

	@Field(() => Int, {description: 'Block height when the transaction entered the mempool'})
	height: number;

	@Field(() => Int, {description: 'Number of descendant transactions in the mempool'})
	descendantcount: number;

	@Field(() => Int, {description: 'Total size of descendant transactions in bytes'})
	descendantsize: number;

	@Field(() => Int, {description: 'Number of ancestor transactions in the mempool'})
	ancestorcount: number;

	@Field(() => Int, {description: 'Total size of ancestor transactions in bytes'})
	ancestorsize: number;

	@Field(() => String, {description: 'Witness transaction identifier'})
	wtxid: string;

	@Field(() => OrchardBitcoinMempoolFees, {description: 'Fee breakdown for this transaction'})
	fees: OrchardBitcoinMempoolFees;

	@Field(() => [String], {description: 'Transaction IDs this transaction depends on'})
	depends: string[];

	@Field(() => [String], {description: 'Transaction IDs that spend outputs of this transaction'})
	spentby: string[];

	@Field(() => Boolean, {description: 'Whether the transaction is BIP125 replaceable'})
	bip125_replaceable: boolean;

	@Field(() => Boolean, {description: 'Whether the transaction has not yet been broadcast'})
	unbroadcast: boolean;

	constructor(tx: BitcoinTransaction, txid: string) {
		this.txid = txid;
		this.vsize = tx.vsize;
		this.weight = tx.weight;
		this.time = tx.time;
		this.height = tx.height;
		this.descendantcount = tx.descendantcount;
		this.descendantsize = tx.descendantsize;
		this.ancestorcount = tx.ancestorcount;
		this.ancestorsize = tx.ancestorsize;
		this.wtxid = tx.wtxid;
		this.fees = tx.fees;
		this.depends = tx.depends;
		this.spentby = tx.spentby;
		this.bip125_replaceable = tx['bip125-replaceable'];
		this.unbroadcast = tx.unbroadcast;
	}
}
