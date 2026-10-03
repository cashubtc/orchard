/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';
import {DEFAULT_SOLVENCY_SOURCES} from '@client/modules/mint/constants/mint.constants';
/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';
/* Local Dependencies */
import {SettingDeviceService} from './setting-device.service';

describe('SettingService', () => {
	let service: SettingDeviceService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(SettingDeviceService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('mint solvency sources', () => {
		let local_storage: LocalStorageService;

		beforeEach(() => {
			local_storage = TestBed.inject(LocalStorageService);
		});

		it('defaults to every channel until a choice is saved', () => {
			spyOn(local_storage, 'getMintSolvency').and.returnValue({sources: null});
			expect(service.getMintSolvencySources()).toEqual(DEFAULT_SOLVENCY_SOURCES);
		});

		it('returns the saved choice, even an empty one', () => {
			spyOn(local_storage, 'getMintSolvency').and.returnValues({sources: [MintReserveSource.MintWallet]}, {sources: []});
			expect(service.getMintSolvencySources()).toEqual([MintReserveSource.MintWallet]);
			expect(service.getMintSolvencySources()).toEqual([]);
		});

		it('saves a choice, including none', () => {
			const set_mint_solvency = spyOn(local_storage, 'setMintSolvency');
			service.setMintSolvencySources([]);
			expect(set_mint_solvency).toHaveBeenCalledWith({sources: []});
		});
	});
});
