/* Application Dependencies */
import type {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import type {BitcoinTxOut} from '#server/modules/bitcoin/rpc/btcrpc.types';

/** Bitcoin Core node behind the BitcoinRpcService reads the wallet makes, for specs; down fails every read like an unreachable node */
export const createFakeChain = () => {
	const fake = {
		configured: true,
		down: false,
		// Unspent outputs by outpoint (txid:vout) with their confirmations, 0 while in the mempool
		outputs: new Map<string, number>(),
		rpc: {
			isConfigured: () => fake.configured,
			getBitcoinTxOut: async (txid: string, vout: number) => {
				if (fake.down) throw new Error('Bitcoin RPC gettxout: ECONNREFUSED');
				const confirmations = fake.outputs.get(`${txid}:${vout}`);
				return confirmations === undefined ? null : ({confirmations} as BitcoinTxOut);
			},
		} satisfies Pick<BitcoinRpcService, 'isConfigured' | 'getBitcoinTxOut'>,
	};
	return fake;
};

export type FakeChain = ReturnType<typeof createFakeChain>;
