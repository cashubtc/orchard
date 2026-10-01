/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {of} from 'rxjs';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {OrcEcashSubsectionWalletModule} from '@client/modules/ecash/modules/ecash-subsection-wallet/ecash-subsection-wallet.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
/* Local Dependencies */
import {EcashSubsectionWalletComponent} from './ecash-subsection-wallet.component';

describe('EcashSubsectionWalletComponent', () => {
	let component: EcashSubsectionWalletComponent;
	let fixture: ComponentFixture<EcashSubsectionWalletComponent>;
	let oracle_enabled: boolean;

	const balances = [new EcashBalance({mint_id: 'mint-1', unit: 'sat', balance: 2100})];
	const mints = [
		new EcashMint({
			id: 'mint-1',
			name: 'Orchard Mint',
			urls: ['https://mint.orchard.example'],
			units: ['sat'],
			is_orchard: true,
			created_at: 0,
		}),
	];
	const ecash_service = {
		loadBalances: jasmine.createSpy('loadBalances').and.returnValue(of(balances)),
		loadMints: jasmine.createSpy('loadMints').and.returnValue(of(mints)),
		loadMintStatuses: jasmine.createSpy('loadMintStatuses').and.returnValue(of([])),
	};
	const price = new BitcoinOraclePrice({date: 0, price: 100_000});
	const bitcoin_service = {loadBitcoinOraclePrice: jasmine.createSpy('loadBitcoinOraclePrice').and.returnValue(of(price))};

	const create = async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashSubsectionWalletModule],
			providers: [
				{provide: EcashService, useValue: ecash_service},
				{provide: BitcoinService, useValue: bitcoin_service},
				{
					provide: SettingAppService,
					useValue: {getSetting: jasmine.createSpy('getSetting').and.callFake(() => ({value: oracle_enabled}))},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashSubsectionWalletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	beforeEach(() => {
		oracle_enabled = false;
		bitcoin_service.loadBitcoinOraclePrice.calls.reset();
	});

	it('should create', async () => {
		await create();
		expect(component).toBeTruthy();
	});

	it('loads the wallet balances', async () => {
		await create();
		expect(component.balances()).toEqual(balances);
		expect(component.loading_balances()).toBeFalse();
	});

	it('loads the wallet mints and their statuses', async () => {
		await create();
		expect(component.mints()).toEqual(mints);
		expect(component.loading_mints()).toBeFalse();
		expect(component.mint_statuses()).toEqual([]);
		expect(component.loading_mint_statuses()).toBeFalse();
	});

	it('skips the oracle price while the oracle is disabled', async () => {
		await create();
		expect(bitcoin_service.loadBitcoinOraclePrice).not.toHaveBeenCalled();
	});

	it('loads the oracle price when the oracle is enabled', async () => {
		oracle_enabled = true;
		await create();
		expect(component.bitcoin_oracle_price()).toEqual(price);
	});
});
