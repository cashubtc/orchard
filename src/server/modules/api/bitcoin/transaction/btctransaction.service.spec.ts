/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {BtcTransactionService} from './btctransaction.service.js';
import {OrchardBitcoinTxFeeEstimate} from './btctransaction.model.js';

describe('BtcTransactionService', () => {
	let btcTransactionService: BtcTransactionService;
	let bitcoinRpcService: jest.Mocked<BitcoinRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BtcTransactionService,
				{provide: BitcoinRpcService, useValue: {getBitcoinFeeEstimate: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		btcTransactionService = module.get<BtcTransactionService>(BtcTransactionService);
		bitcoinRpcService = module.get(BitcoinRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(btcTransactionService).toBeDefined();
	});

	it('maps fee estimates and returns OrchardBitcoinTxFeeEstimate[]', async () => {
		bitcoinRpcService.getBitcoinFeeEstimate.mockResolvedValueOnce(10 as any);
		bitcoinRpcService.getBitcoinFeeEstimate.mockResolvedValueOnce(20 as any);
		const result = await btcTransactionService.getTransactionFeeEstimates('TAG', [1, 2]);
		expect(result).toHaveLength(2);
		expect(result[0]).toBeInstanceOf(OrchardBitcoinTxFeeEstimate);
		expect(bitcoinRpcService.getBitcoinFeeEstimate).toHaveBeenCalledWith(1);
		expect(bitcoinRpcService.getBitcoinFeeEstimate).toHaveBeenCalledWith(2);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		bitcoinRpcService.getBitcoinFeeEstimate.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});
		await expect(btcTransactionService.getTransactionFeeEstimates('MY_TAG', [1])).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.BitcoinRPCError});
	});
});
