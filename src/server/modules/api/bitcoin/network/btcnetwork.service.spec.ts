/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
/* Local Dependencies */
import {BitcoinNetworkService} from './btcnetwork.service.js';

describe('BitcoinNetworkService', () => {
	let bitcoinNetworkService: BitcoinNetworkService;
	let bitcoinRpcService: jest.Mocked<BitcoinRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinNetworkService,
				{
					provide: BitcoinRpcService,
					useValue: {getBitcoinNetworkInfo: jest.fn(), getBitcoinBlockchainInfo: jest.fn()},
				},
				{provide: LightningService, useValue: {isConfigured: jest.fn().mockReturnValue(false), getLightningInfo: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		bitcoinNetworkService = module.get<BitcoinNetworkService>(BitcoinNetworkService);
		bitcoinRpcService = module.get(BitcoinRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(bitcoinNetworkService).toBeDefined();
	});

	it('maps network info and normalizes warnings to an array', async () => {
		// Arrange
		const rpc_info: any = {
			version: 1,
			subversion: '/Satoshi:28.0.0/',
			protocolversion: 70016,
			localservices: '0000000000000409',
			localservicesnames: ['NETWORK', 'WITNESS', 'COMPACT_FILTERS'],
			localrelay: true,
			timeoffset: 0,
			connections: 8,
			connections_in: 3,
			connections_out: 5,
			networkactive: true,
			networks: [{name: 'ipv4', limited: false, reachable: true, proxy: '', proxy_randomize_credentials: false}],
			relayfee: 0.00001,
			incrementalfee: 0.00001,
			localaddresses: [{address: '127.0.0.1', port: 8333, score: 1}],
			warnings: 'all good', // string form
		};
		bitcoinRpcService.getBitcoinNetworkInfo.mockResolvedValue(rpc_info);

		// Act
		const result = await bitcoinNetworkService.getBitcoinNetworkInfo();

		// Assert
		expect(result.version).toBe(1);
		expect(result.subversion).toBe('/Satoshi:28.0.0/');
		expect(result.connections).toBe(8);
		expect(Array.isArray(result.warnings)).toBe(true);
		expect(result.warnings).toEqual(['all good']);
		expect(result.networks?.length).toBe(1);
		expect(result.localaddresses?.length).toBe(1);
	});

	it('wraps RPC errors via resolveError and throws OrchardApiError (default tag)', async () => {
		// Arrange
		const rpc_error = new Error('rpc failed');
		bitcoinRpcService.getBitcoinNetworkInfo.mockRejectedValue(rpc_error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});

		// Act
		await expect(bitcoinNetworkService.getBitcoinNetworkInfo()).rejects.toBeInstanceOf(OrchardApiError);

		// Assert
		expect(errorService.resolveError).toHaveBeenCalled();
		const [, , tag_arg, code_arg] = errorService.resolveError.mock.calls[0];
		expect(tag_arg).toBe('GET { bitcoin_network_info }'); // default tag
		expect(code_arg).toEqual({errord: OrchardErrorCode.BitcoinRPCError});
	});

	it('uses custom tag in errors', async () => {
		// Arrange
		const rpc_error = new Error('rpc failed');
		bitcoinRpcService.getBitcoinNetworkInfo.mockRejectedValue(rpc_error);
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinRPCError});

		// Act
		await expect(bitcoinNetworkService.getBitcoinNetworkInfo('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);

		// Assert
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
	});
});
