/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {createFakeChain, type FakeChain} from '#server/test/bitcoin-fake-chain';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
/* Native Dependencies */
import type {CashuWalletDepositTrack} from '#server/modules/cashu/wallet/cashuwallet.types';
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

	describe('trackDeposits', () => {
		const ADDRESS = 'bcrt1qdeposit';
		const track = (changes: Partial<CashuWalletDepositTrack> = {}): CashuWalletDepositTrack => ({
			id: 'quote-1',
			request: ADDRESS,
			chain_height: chain.tip(),
			amount_paid: 0,
			deposits: [],
			required: 3,
			min_amount: 1000,
			...changes,
		});
		/** A track after one run, as the quote service stores it */
		const follow = async (current: CashuWalletDepositTrack): Promise<CashuWalletDepositTrack> => ({
			...current,
			...(await service.trackDeposits([current])).get(current.id),
		});
		const amounts = (current: CashuWalletDepositTrack) => current.deposits.map(({amount}) => amount);

		it('scans a new address over only the blocks a deposit to it could still be confirming in', async () => {
			const blocks = jest.spyOn(chain.rpc, 'getBitcoinBlock');
			chain.mine({address: ADDRESS, amount: 2000});
			chain.mine({address: ADDRESS, amount: 5000});
			chain.mine();
			const current = await follow(track({chain_height: null}));
			expect(current).toMatchObject({chain_height: chain.tip(), deposits: [{amount: 5000, height: chain.tip() - 1}]});
			expect(blocks).toHaveBeenCalledTimes(2);
		});

		it('lists a deposit from the block it lands in, reading strictly, and keeps it confirmed until the mint credits it', async () => {
			const blocks = jest.spyOn(chain.rpc, 'getBitcoinBlock');
			let current = track();
			const [txid] = chain.mine({address: ADDRESS, amount: 5000});
			current = await follow(current);
			expect(current).toMatchObject({chain_height: chain.tip(), deposits: [{txid, vout: 0, amount: 5000, height: chain.tip()}]});
			expect(current.deposits[0].paid_when_credited).toBe(5000);
			expect(blocks).toHaveBeenCalledWith(`block-${chain.tip()}-0`, {strict: true, timeout_ms: 60_000});
			chain.mine();
			chain.mine();
			chain.mine();
			current = await follow(current);
			expect(amounts(current)).toEqual([5000]);
			expect(amounts(await follow({...current, amount_paid: 5000}))).toEqual([]);
		});

		it('drops deposits in one block one by one as the mint credits them in turn', async () => {
			let current = track({amount_paid: 1000});
			chain.mine({address: ADDRESS, amount: 2000}, {address: ADDRESS, amount: 3000});
			current = await follow(current);
			expect(current.deposits.map(({paid_when_credited}) => paid_when_credited)).toEqual([3000, 6000]);
			current = await follow({...current, amount_paid: 3000});
			expect(amounts(current)).toEqual([3000]);
			expect(amounts(await follow({...current, amount_paid: 6000}))).toEqual([]);
		});

		it("drops a deposit under the mint's minimum at the required count, without waiting on it for the next", async () => {
			let current = track();
			chain.mine({address: ADDRESS, amount: 500}, {address: ADDRESS, amount: 2000});
			current = await follow(current);
			expect(current.deposits.map(({paid_when_credited}) => paid_when_credited)).toEqual([null, 2000]);
			chain.mine();
			chain.mine();
			expect(amounts(await follow(current))).toEqual([2000]);
		});

		it('gives up on a deposit the mint never credits a day past the required count', async () => {
			let current = track();
			chain.mine({address: ADDRESS, amount: 5000});
			current = await follow(current);
			for (let block = 0; block < 145; block++) chain.mine();
			current = await follow(current);
			expect(amounts(current)).toEqual([5000]);
			chain.mine();
			expect(amounts(await follow(current))).toEqual([]);
		});

		it('drops a deposit whose block left the chain, and finds it again once it is mined again', async () => {
			let current = track();
			const [txid] = chain.mine({address: ADDRESS, amount: 5000});
			const height = chain.tip();
			current = await follow(current);
			chain.reorg(1);
			current = await follow(current);
			expect(current).toMatchObject({chain_height: height - 1, deposits: []});
			chain.mine({address: ADDRESS, amount: 5000, txid});
			current = await follow(current);
			expect(current.deposits).toEqual([expect.objectContaining({txid, height, blockhash: `block-${height}-1`})]);
		});

		it('catches up only on the blocks still confirming after an outage', async () => {
			const current = track();
			chain.mine({address: ADDRESS, amount: 5000});
			for (let block = 0; block < 20; block++) chain.mine();
			const blocks = jest.spyOn(chain.rpc, 'getBitcoinBlock');
			expect(await follow(current)).toMatchObject({chain_height: chain.tip(), deposits: []});
			expect(blocks).toHaveBeenCalledTimes(2);
		});

		it('reads each new block once however many addresses it follows', async () => {
			const blocks = jest.spyOn(chain.rpc, 'getBitcoinBlock');
			const first = track();
			const second = track({id: 'quote-2', request: 'bcrt1qother'});
			chain.mine({address: ADDRESS, amount: 2000}, {address: 'bcrt1qother', amount: 3000});
			const updates = await service.trackDeposits([first, second]);
			expect([updates.get('quote-1')?.deposits[0].amount, updates.get('quote-2')?.deposits[0].amount]).toEqual([2000, 3000]);
			expect(blocks).toHaveBeenCalledTimes(1);
		});

		it('reads nothing without a node, and leaves every address as it was while the node is down', async () => {
			const tips = jest.spyOn(chain.rpc, 'getBitcoinBlockCount');
			chain.configured = false;
			expect((await service.trackDeposits([track()])).size).toBe(0);
			expect(tips).not.toHaveBeenCalled();
			chain.configured = true;
			chain.down = true;
			expect((await service.trackDeposits([track()])).size).toBe(0);
		});
	});
});
