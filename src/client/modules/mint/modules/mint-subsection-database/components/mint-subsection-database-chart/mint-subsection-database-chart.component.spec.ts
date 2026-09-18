/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SimpleChange} from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
/* Vendor Dependencies */
import {ChartDataset} from 'chart.js';
/* Application Dependencies */
import {DataType} from '@client/modules/orchard/enums/data.enum';
import {ThemeService} from '@client/modules/settings/services/theme/theme.service';
/* Native Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
import {MintSubsectionDatabaseData} from '@client/modules/mint/modules/mint-subsection-database/classes/mint-subsection-database-data.class';
/* Local Dependencies */
import {MintSubsectionDatabaseChartComponent} from './mint-subsection-database-chart.component';
/* Shared Dependencies */
import {MintQuoteState} from '@shared/generated.types';

describe('MintSubsectionDatabaseChartComponent', () => {
	let component: MintSubsectionDatabaseChartComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
			declarations: [MintSubsectionDatabaseChartComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseChartComponent);
		component = fixture.componentInstance;
		component.locale = 'en-US';
		component.data = {type: 'mint', source: {data: [], filteredData: []}} as unknown as MintSubsectionDatabaseData;
		component.filter = '';
		component.page_settings = {date_start: 0, date_end: 0, units: [], states: [], type: 'mint', page: 1, page_size: 10} as any;
		component.mint_genesis_time = 0;
		component.loading = false;
		component.state_enabled = false;
		fixture.componentRef.setInput('device_mobile', false);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('keeps a custom unit shade when another custom unit is filtered out', () => {
		spyOn(TestBed.inject(ThemeService), 'getThemeColor').and.returnValue('#A99BC9');
		fixture.componentRef.setInput('mint_keysets', [{unit: 'ora'}, {unit: 'hours'}]);
		const quotes = ['ora', 'hours'].map(
			(unit) =>
				new MintMintQuote({
					id: unit,
					unit,
					amount: 10,
					request: unit,
					state: MintQuoteState.Issued,
					created_time: 1,
					amount_paid: 10,
					amount_issued: 10,
					payment_method: 'branch',
				}),
		);
		const source = new MatTableDataSource(quotes);
		source.filterPredicate = (quote, filter) => quote.unit === filter;
		component.data = {type: DataType.MintMints, source};
		component.ngOnChanges({filter: new SimpleChange(null, '', false)});
		const datasets = component.chart_data.datasets as ChartDataset<'scatter'>[];
		const original_color = datasets.find((dataset) => dataset.label === 'ORA')!.pointHoverBorderColor;
		expect(original_color).not.toEqual(datasets.find((dataset) => dataset.label === 'HOURS')!.pointHoverBorderColor);

		source.filter = 'ora';
		component.ngOnChanges({filter: new SimpleChange('', 'ora', false)});
		const filtered = component.chart_data.datasets as ChartDataset<'scatter'>[];
		expect(filtered.length).toBe(1);
		expect(filtered[0].label).toBe('ORA');
		expect(filtered[0].pointHoverBorderColor).toEqual(original_color);
	});
});
