/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {MatSelect} from '@angular/material/select';

/* Native Dependencies */
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
import {MintDataType} from '@client/modules/mint/enums/data-type.enum';
/* Local Dependencies */
import {MintSubsectionDatabaseControlComponent} from './mint-subsection-database-control.component';

describe('MintSubsectionDatabaseControlComponent', () => {
	let component: MintSubsectionDatabaseControlComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseControlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseControlComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('page_settings', {
			date_start: 0,
			date_end: 0,
			date_preset: null,
			type: MintDataType.MintMints,
			units: [],
			states: [],
		});
		fixture.componentRef.setInput('unit_options', []);
		fixture.componentRef.setInput('state_options', []);
		fixture.componentRef.setInput('state_enabled', false);
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('mint_genesis_time', 0);
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('reuses the data type options when loading completes again', async () => {
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		await fixture.whenStable();

		const select = fixture.debugElement.query(By.directive(MatSelect)).componentInstance as MatSelect;
		const original_options = select.options.toArray();
		expect(original_options.map((option) => option.value)).toEqual(Object.values(MintDataType));

		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		await fixture.whenStable();

		const reloaded_options = select.options.toArray();
		expect(reloaded_options.length).toBe(original_options.length);
		reloaded_options.forEach((option, index) => expect(option).toBe(original_options[index]));
	});
});
