/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {BitcoinUTXOracleService} from '#server/modules/bitcoin/utxoracle/utxoracle.service';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {BitcoinOracleService} from './btcoracle.service.js';

describe('BitcoinOracleService', () => {
	let bitcoinOracleService: BitcoinOracleService;
	let errorService: jest.Mocked<ErrorService>;
	let utxOracle: jest.Mocked<BitcoinUTXOracleService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinOracleService,
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
				{
					provide: BitcoinUTXOracleService,
					useValue: {
						runOracle: jest.fn(),
						getOraclePrice: jest.fn(),
						getOraclePriceRange: jest.fn(),
						saveOraclePrice: jest.fn(),
					},
				},
				{
					provide: BitcoinRpcService,
					useValue: {
						getBitcoinBlockchainInfo: jest.fn(),
					},
				},
			],
		}).compile();

		bitcoinOracleService = module.get<BitcoinOracleService>(BitcoinOracleService);
		errorService = module.get(ErrorService);
		utxOracle = module.get(BitcoinUTXOracleService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(bitcoinOracleService).toBeDefined();
	});

	it('returns single oracle price when no timestamps provided', async () => {
		// arrange
		const mock_price = {id: '1', date: 1234567890, price: 50000};
		utxOracle.getOraclePrice.mockResolvedValue(mock_price as any);

		// act
		const result = await bitcoinOracleService.getOracle('TAG');

		// assert
		expect(result).toHaveLength(1);
		expect(result[0]).toHaveProperty('price', 50000);
		expect(utxOracle.getOraclePrice).toHaveBeenCalledTimes(1);
	});

	it('returns empty array when no oracle price exists', async () => {
		// arrange
		utxOracle.getOraclePrice.mockResolvedValue(null);

		// act
		const result = await bitcoinOracleService.getOracle('TAG');

		// assert
		expect(result).toEqual([]);
		expect(utxOracle.getOraclePrice).toHaveBeenCalledTimes(1);
	});

	it('returns price range when timestamps provided', async () => {
		// arrange
		const mock_prices = [
			{id: '1', date: 1234567890, price: 50000},
			{id: '2', date: 1234654290, price: 51000},
		];
		utxOracle.getOraclePriceRange.mockResolvedValue(mock_prices as any);

		// act
		const result = await bitcoinOracleService.getOracle('TAG', 1234567890, 1234654290);

		// assert
		expect(result).toHaveLength(2);
		expect(result[0]).toHaveProperty('price', 50000);
		expect(result[1]).toHaveProperty('price', 51000);
		expect(utxOracle.getOraclePriceRange).toHaveBeenCalledWith(1234567890, 1234654290);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		// arrange
		const error = new Error('boom');
		utxOracle.getOraclePrice.mockRejectedValue(error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});

		// act & assert
		await expect(bitcoinOracleService.getOracle('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'MY_TAG', {
			errord: OrchardErrorCode.BitcoinRPCError,
		});
	});
});
