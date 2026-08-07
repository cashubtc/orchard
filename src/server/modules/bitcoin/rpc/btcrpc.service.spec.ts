/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Native Dependencies */
import {CoreService} from '#server/modules/bitcoin/core/core.service';
/* Local Dependencies */
import {BitcoinRpcService} from './btcrpc.service.js';
import {BitcoinType} from '#server/modules/bitcoin/bitcoin.enums';

describe('BitcoinRpcService', () => {
	let bitcoinRpcService: BitcoinRpcService;
	let configService: jest.Mocked<ConfigService>;
	let coreService: jest.Mocked<CoreService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinRpcService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CoreService, useValue: {initializeRpc: jest.fn(), makeRpcRequest: jest.fn()}},
			],
		}).compile();

		bitcoinRpcService = module.get<BitcoinRpcService>(BitcoinRpcService);
		configService = module.get(ConfigService);
		coreService = module.get(CoreService);
		// make service think we're CORE
		configService.get.mockReturnValue(BitcoinType.CORE);
		await bitcoinRpcService.onModuleInit();
	});

	it('should be defined', () => {
		expect(bitcoinRpcService).toBeDefined();
	});

	it('initializes CORE rpc on module init', async () => {
		expect(coreService.initializeRpc).toHaveBeenCalled();
	});

	it('delegates blockchain calls to CoreService', async () => {
		coreService.makeRpcRequest.mockResolvedValueOnce(100);
		await expect(bitcoinRpcService.getBitcoinBlockCount()).resolves.toBe(100);
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblockcount', []);

		coreService.makeRpcRequest.mockResolvedValueOnce({chain: 'regtest'} as any);
		await bitcoinRpcService.getBitcoinBlockchainInfo();
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblockchaininfo', []);

		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinBlock('h');
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblock', ['h', 2]);

		coreService.makeRpcRequest.mockResolvedValueOnce('h');
		await bitcoinRpcService.getBitcoinBlockHash(5);
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblockhash', [5]);

		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinBlockHeader('h');
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblockheader', ['h', true]);

		coreService.makeRpcRequest.mockResolvedValueOnce('raw');
		await bitcoinRpcService.getBitcoinBlockRaw('h');
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblock', ['h', 0]);
	});

	it('delegates network/mempool/mining/utilities calls', async () => {
		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinNetworkInfo();
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getnetworkinfo', []);

		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinMempool();
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getrawmempool', [true]);

		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinBlockTemplate();
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('getblocktemplate', [{rules: ['segwit'], mode: 'template'}]);

		coreService.makeRpcRequest.mockResolvedValueOnce({} as any);
		await bitcoinRpcService.getBitcoinFeeEstimate(6);
		expect(coreService.makeRpcRequest).toHaveBeenCalledWith('estimatesmartfee', [6]);
	});
});
