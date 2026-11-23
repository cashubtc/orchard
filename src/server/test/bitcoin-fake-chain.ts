/* Application Dependencies */
import type {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import type {BitcoinBlock, BitcoinTxOut} from '#server/modules/bitcoin/rpc/btcrpc.types';

type FakePayment = {address: string; amount: number; txid?: string};
type FakeBlock = {hash: string; payments: Required<FakePayment>[]};

/** Bitcoin Core node behind the BitcoinRpcService reads the wallet makes, for specs; down fails every read like an unreachable node */
export function createFakeChain() {
	let branch = 0;
	let tx_count = 0;
	const refuseWhileDown = (method: string): void => {
		if (fake.down) throw new Error(`Bitcoin RPC ${method}: ECONNREFUSED`);
	};
	const fake = {
		configured: true,
		down: false,
		// Unspent outputs by outpoint (txid:vout) with their confirmations, 0 while in the mempool
		outputs: new Map<string, number>(),
		// The main chain by height
		blocks: [{hash: 'block-0-0', payments: []}] as FakeBlock[],
		/** Height of the chain's tip */
		tip: (): number => fake.blocks.length - 1,
		/** Mine a block carrying each payment as its own transaction (keeping a txid given, as when one is mined again); its txids */
		mine: (...payments: FakePayment[]): string[] => {
			const mined = payments.map((payment) => ({...payment, txid: payment.txid ?? `tx-${++tx_count}`}));
			fake.blocks.push({hash: `block-${fake.blocks.length}-${branch}`, payments: mined});
			return mined.map(({txid}) => txid);
		},
		/** Take the top blocks off the chain, as a reorg does; blocks mined after are on a new branch */
		reorg: (depth: number): void => {
			fake.blocks.splice(-depth);
			branch++;
		},
		rpc: {
			isConfigured: () => fake.configured,
			getBitcoinBlockCount: async () => {
				refuseWhileDown('getblockcount');
				return fake.tip();
			},
			getBitcoinBlockHash: async (height: number) => {
				refuseWhileDown('getblockhash');
				if (!fake.blocks[height]) throw new Error('Bitcoin RPC getblockhash: Block height out of range');
				return fake.blocks[height].hash;
			},
			getBitcoinBlock: async (hash: string) => {
				refuseWhileDown('getblock');
				const block = fake.blocks.find((candidate) => candidate.hash === hash);
				if (!block) throw new Error('Bitcoin RPC getblock: Block not found');
				const tx = block.payments.map(({address, amount, txid}) => ({
					txid,
					vout: [{value: amount / 1e8, n: 0, scriptPubKey: {address}}],
				}));
				return {tx} as unknown as BitcoinBlock;
			},
			getBitcoinTxOut: async (txid: string, vout: number) => {
				refuseWhileDown('gettxout');
				const confirmations = fake.outputs.get(`${txid}:${vout}`);
				return confirmations === undefined ? null : ({confirmations} as BitcoinTxOut);
			},
		} satisfies Pick<
			BitcoinRpcService,
			'isConfigured' | 'getBitcoinBlockCount' | 'getBitcoinBlockHash' | 'getBitcoinBlock' | 'getBitcoinTxOut'
		>,
	};
	return fake;
}

export type FakeChain = ReturnType<typeof createFakeChain>;
