/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletMintService} from '#server/modules/cashu/wallet/cashuwalletmint.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashMintService} from './ecashmint.service.js';
import {OrchardEcashMint} from './ecashmint.model.js';

describe('EcashMintService', () => {
	let ecashMintService: EcashMintService;
	let cashuWalletMintService: jest.Mocked<CashuWalletMintService>;
	let errorService: jest.Mocked<ErrorService>;

	const mint = {
		id: 'mint-1',
		user_id: 'user-1',
		pubkey: '02orchard',
		urls: ['https://mint.orchard.example'],
		name: 'Orchard Test Mint',
		info: JSON.stringify({
			icon_url: 'https://mint.orchard.example/icon.png',
			nuts: {4: {methods: [{unit: 'sat'}, {unit: 'usd'}, {unit: 'sat'}]}},
		}),
		info_updated_at: 0,
		created_at: 0,
		is_orchard: true,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashMintService,
				{provide: CashuWalletMintService, useValue: {listMints: jest.fn(), addMint: jest.fn(), removeMint: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashMintService = module.get<EcashMintService>(EcashMintService);
		cashuWalletMintService = module.get(CashuWalletMintService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashMintService).toBeDefined();
	});

	it('getEcashMints maps wallet mints, reading icon and units from the cached info', async () => {
		cashuWalletMintService.listMints.mockResolvedValue([mint]);
		const [result] = await ecashMintService.getEcashMints('TAG', 'user-1');
		expect(result).toBeInstanceOf(OrchardEcashMint);
		expect(result).toMatchObject({icon_url: 'https://mint.orchard.example/icon.png', units: ['sat', 'usd'], is_orchard: true});
	});

	it('addEcashMint passes the URL through', async () => {
		cashuWalletMintService.addMint.mockResolvedValue({...mint, info: null, is_orchard: false});
		const result = await ecashMintService.addEcashMint('TAG', 'user-1', 'https://cedar.example');
		expect(cashuWalletMintService.addMint).toHaveBeenCalledWith('user-1', 'https://cedar.example');
		expect(result).toMatchObject({icon_url: null, units: []});
	});

	it('removeEcashMint returns true once removed', async () => {
		await expect(ecashMintService.removeEcashMint('TAG', 'user-1', 'mint-2')).resolves.toBe(true);
	});

	it('wraps wallet errors as OrchardApiError, keeping details', async () => {
		const wallet_error = {code: OrchardErrorCode.EcashWalletError, details: 'Mint URLs must use https'};
		cashuWalletMintService.addMint.mockRejectedValue(wallet_error);
		errorService.resolveError.mockReturnValue(wallet_error);
		await expect(ecashMintService.addEcashMint('TAG', 'user-1', 'http://x')).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), wallet_error, 'TAG', {
			errord: OrchardErrorCode.EcashWalletError,
		});
	});
});
