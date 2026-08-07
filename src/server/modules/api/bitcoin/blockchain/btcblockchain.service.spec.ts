/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {BitcoinBlockchainService} from './btcblockchain.service.js';
import {OrchardBitcoinBlockchainInfo, OrchardBitcoinBlockCount} from './btcblockchain.model.js';

describe('BitcoinBlockchainService', () => {
	let bitcoinBlockchainService: BitcoinBlockchainService;
	let bitcoinRpcService: jest.Mocked<BitcoinRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinBlockchainService,
				{provide: BitcoinRpcService, useValue: {getBitcoinBlockchainInfo: jest.fn(), getBitcoinBlockCount: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		bitcoinBlockchainService = module.get<BitcoinBlockchainService>(BitcoinBlockchainService);
		bitcoinRpcService = module.get(BitcoinRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(bitcoinBlockchainService).toBeDefined();
	});

	it('getBlockchainInfo returns OrchardBitcoinBlockchainInfo', async () => {
		bitcoinRpcService.getBitcoinBlockchainInfo.mockResolvedValue({
			chain: 'regtest',
			blocks: 1,
			headers: 1,
			bestblockhash: 'h',
			difficulty: 1,
			verificationprogress: 1,
			initialblockdownload: false,
			chainwork: 'c',
			size_on_disk: 1,
			pruned: false,
			pruneheight: null,
			automatic_pruning: null,
			prune_target_size: null,
			warnings: '',
		} as any);
		const result = await bitcoinBlockchainService.getBlockchainInfo('TAG');
		expect(result).toBeInstanceOf(OrchardBitcoinBlockchainInfo);
	});

	it('getBlockCount returns OrchardBitcoinBlockCount', async () => {
		bitcoinRpcService.getBitcoinBlockCount.mockResolvedValue(123 as any);
		const result = await bitcoinBlockchainService.getBlockCount('TAG');
		expect(result).toBeInstanceOf(OrchardBitcoinBlockCount);
		expect(result.height).toBe(123);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		bitcoinRpcService.getBitcoinBlockchainInfo.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});
		await expect(bitcoinBlockchainService.getBlockchainInfo('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.BitcoinRPCError});
	});
});
