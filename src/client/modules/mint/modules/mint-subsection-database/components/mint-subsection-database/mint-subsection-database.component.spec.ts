/* Core Dependencies */
import {ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';

/* Vendor Dependencies */
import {of, throwError} from 'rxjs';

/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';

/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintSwap} from '@client/modules/mint/classes/mint-swap.class';
import {MintDataType} from '@client/modules/mint/enums/data-type.enum';
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
import {MintSubsectionDatabaseComponent} from './mint-subsection-database.component';

/* Shared Dependencies */
import {MintQuoteState, MeltQuoteState} from '@shared/generated.types';

describe('MintSubsectionDatabaseComponent', () => {
	let component: MintSubsectionDatabaseComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseComponent>;
	let lightningService: LightningService;
	let mintService: MintService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
			declarations: [MintSubsectionDatabaseComponent],
			providers: [{provide: ActivatedRoute, useValue: {snapshot: {data: {mint_keysets: []}}}}, provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseComponent);
		component = fixture.componentInstance;
		lightningService = TestBed.inject(LightningService);
		mintService = TestBed.inject(MintService);
		spyOn(TestBed.inject(SettingDeviceService), 'setMintDatabaseSettings');
		const quote_data = ['sat', 'ora'].map((unit) => ({
			id: `${unit}-quote`,
			unit,
			request: 'payment-request',
			amount: 100,
			created_time: 1_750_000_000,
		}));
		spyOn(mintService, 'getMintMintQuotesData').and.returnValue(
			of({
				mint_mint_quotes: quote_data.map(
					(quote) =>
						new MintMintQuote({
							...quote,
							state: MintQuoteState.Issued,
							amount_paid: 100,
							amount_issued: 100,
							payment_method: 'bolt11',
						}),
				),
				count: 40,
			}),
		);
		spyOn(mintService, 'getMintMeltQuotesData').and.returnValue(
			of({
				mint_melt_quotes: quote_data.map(
					(quote) => new MintMeltQuote({...quote, state: MeltQuoteState.Paid, fee_reserve: 0, payment_method: 'bolt11'}),
				),
				count: 40,
			}),
		);
		spyOn(mintService, 'getMintSwapsData').and.returnValue(
			of({mint_swaps: quote_data.map((quote) => new MintSwap({...quote, keyset_ids: ['keyset-id']})), count: 40}),
		);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('search across data reloads', () => {
		/** Sends a real input event so the search handler reads the field's current value. */
		function search(value: string): void {
			const input = document.createElement('input');
			input.value = value;
			input.addEventListener('input', (event: Event) => component.onFilterChange(event));
			input.dispatchEvent(new Event('input'));
		}

		for (const [type, service_method] of [
			[MintDataType.MintMints, 'getMintMintQuotesData'],
			[MintDataType.MintMelts, 'getMintMeltQuotesData'],
			[MintDataType.MintSwaps, 'getMintSwapsData'],
		] as const) {
			describe(type, () => {
				beforeEach(fakeAsync(() => {
					component.onTypeChange(type);
					flushMicrotasks();
				}));

				for (const [action, page_index, page_size] of [
					['next page', 1, 10],
					['page size change', 0, 25],
				] as const) {
					it(`keeps the normalized search active after ${action}`, fakeAsync(() => {
						search('  ORA  ');
						const previous_source = component.data.source;
						component.onPage({pageIndex: page_index, pageSize: page_size, length: 40});
						flushMicrotasks();

						expect(mintService[service_method]).toHaveBeenCalledWith(
							jasmine.objectContaining({page: page_index + 1, page_size}),
						);
						expect(component.data.source).not.toBe(previous_source);
						expect(component.filter).toBe('  ORA  ');
						expect(component.data.source.filteredData.map((row) => row.unit)).toEqual(['ora']);
						expect(component.count).toBe(40);
					}));
				}

				it('keeps unmatched searches empty after refresh and restores rows when cleared', fakeAsync(() => {
					search('no-match');
					component.onRefresh();
					flushMicrotasks();
					expect(component.data.source.filteredData).toEqual([]);

					search('');
					component.onPage({pageIndex: 1, pageSize: 10, length: 40});
					flushMicrotasks();
					expect(component.data.source.filteredData.map((row) => row.unit)).toEqual(['sat', 'ora']);
				}));
			});
		}
	});

	describe('onMoreRequest', () => {
		it('should skip lightning decode for onchain requests', () => {
			const decode_spy = spyOn(lightningService, 'getLightningRequest').and.returnValue(of({} as any));
			(component as any).lightning_enabled = true;
			component.lightning_request = {} as any;

			component.onMoreRequest({
				id: 'quote-id',
				request: 'bcrt1qexampleonchainaddress',
				payment_method: 'onchain',
				unit: 'sat',
				created_time: 1,
				amount_paid: 1000,
			} as any);

			expect(decode_spy).not.toHaveBeenCalled();
			expect(component.lightning_request).toBeNull();
			expect(component.loading_more).toBeFalse();
		});

		it('should decode bolt11 and bolt12 payment requests', fakeAsync(() => {
			const decode_spy = spyOn(lightningService, 'getLightningRequest').and.returnValue(of({destination: 'pubkey'} as any));
			(component as any).lightning_enabled = true;

			component.onMoreRequest({request: 'lnbc1example', payment_method: 'bolt11'} as any);
			tick();

			component.onMoreRequest({request: 'lno1example', payment_method: 'bolt12'} as any);
			tick();

			expect(decode_spy).toHaveBeenCalledTimes(2);
			expect(decode_spy).toHaveBeenCalledWith('lnbc1example');
			expect(decode_spy).toHaveBeenCalledWith('lno1example');
			expect(component.loading_more).toBeFalse();
		}));

		it('should clear loading state when lightning decode fails', fakeAsync(() => {
			const error_spy = spyOn(console, 'error');
			spyOn(lightningService, 'getLightningRequest').and.returnValue(throwError(() => new Error('decode failed')));
			(component as any).lightning_enabled = true;

			component.onMoreRequest({request: 'lnbc1bad', payment_method: 'bolt11'} as any);
			tick();

			expect(component.lightning_request).toBeNull();
			expect(component.loading_more).toBeFalse();
			expect(error_spy).toHaveBeenCalled();
		}));
	});
});
