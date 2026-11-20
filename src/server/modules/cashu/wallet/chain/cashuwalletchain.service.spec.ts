/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {createFakeChain, type FakeChain} from '#server/test/bitcoin-fake-chain';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
/* Local Dependencies */
import {CashuWalletChainService} from './cashuwalletchain.service.js';

const TXID = 'ab'.repeat(32);
const OUTPOINT = `${TXID}:1`;

describe('CashuWalletChainService', () => {
	let service: CashuWalletChainService;
	let chain: FakeChain;

	beforeEach(async () => {
		chain = createFakeChain();
		const module: TestingModule = await Test.createTestingModule({
			providers: [CashuWalletChainService, {provide: BitcoinRpcService, useValue: chain.rpc}],
		}).compile();
		service = module.get(CashuWalletChainService);
	});

	describe('confirmations', () => {
		it('counts a payment 0 while it waits in the mempool, then by the blocks on top of it, reading the node strictly', async () => {
			const reads = jest.spyOn(chain.rpc, 'getBitcoinTxOut');
			chain.outputs.set(OUTPOINT, 0);
			expect(await service.confirmations(OUTPOINT, null)).toBe(0);
			chain.outputs.set(OUTPOINT, 3);
			expect(await service.confirmations(OUTPOINT, 0)).toBe(3);
			expect(reads).toHaveBeenCalledWith(TXID, 1, {strict: true, timeout_ms: 10_000});
		});

		it('can tell nothing once the node holds no such unspent output, as when it is spent or on another chain', async () => {
			expect(await service.confirmations(OUTPOINT, 3)).toBeNull();
		});

		it('asks nothing without a Bitcoin node, or of an outpoint that is not one', async () => {
			const reads = jest.spyOn(chain.rpc, 'getBitcoinTxOut');
			chain.outputs.set(OUTPOINT, 2);
			chain.configured = false;
			expect(await service.confirmations(OUTPOINT, 2)).toBeNull();
			chain.configured = true;
			expect(await service.confirmations('ab:1', 2)).toBeNull();
			expect(reads).not.toHaveBeenCalled();
		});

		it('keeps the count it knew while the node cannot be read', async () => {
			chain.down = true;
			expect(await service.confirmations(OUTPOINT, 2)).toBe(2);
		});
	});
});
