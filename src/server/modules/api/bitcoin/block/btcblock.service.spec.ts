/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {BitcoinBlockService} from './btcblock.service.js';
import {OrchardBitcoinBlock, OrchardBitcoinBlockTemplate} from './btcblock.model.js';

describe('BitcoinBlockService', () => {
	let bitcoinBlockService: BitcoinBlockService;
	let bitcoinRpcService: jest.Mocked<BitcoinRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinBlockService,
				{provide: BitcoinRpcService, useValue: {getBitcoinBlock: jest.fn(), getBitcoinBlockTemplate: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		bitcoinBlockService = module.get<BitcoinBlockService>(BitcoinBlockService);
		bitcoinRpcService = module.get(BitcoinRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(bitcoinBlockService).toBeDefined();
	});

	it('returns OrchardBitcoinBlock on getBlock', async () => {
		bitcoinRpcService.getBitcoinBlock.mockResolvedValue({
			hash: 'h',
			height: 1,
			time: 0,
			chainwork: 'c',
			nTx: 1,
			weight: 100,
			tx: [{txid: 'a', vin: [], vout: [], fee: 1, vsize: 100}],
		} as any);
		const result = await bitcoinBlockService.getBlock('TAG', 'hash');
		expect(result).toBeInstanceOf(OrchardBitcoinBlock);
		expect(bitcoinRpcService.getBitcoinBlock).toHaveBeenCalledWith('hash');
	});

	it('returns OrchardBitcoinBlockTemplate on getBlockTemplate', async () => {
		bitcoinRpcService.getBitcoinBlockTemplate.mockResolvedValue({
			height: 1,
			transactions: [{txid: 'a', fee: 1, weight: 400, depends: [], data: 'aabb'}],
		} as any);
		const result = await bitcoinBlockService.getBlockTemplate('TAG');
		expect(result).toBeInstanceOf(OrchardBitcoinBlockTemplate);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		const err = new Error('boom');
		bitcoinRpcService.getBitcoinBlock.mockRejectedValue(err);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});
		await expect(bitcoinBlockService.getBlock('MY_TAG', 'hash')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.BitcoinRPCError});
	});
});
