/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
/* Shared Dependencies */
import {WalletOperationState, WalletOperationType} from '@shared/generated.types';
/* Local Dependencies */
import {EcashGeneralActivityComponent} from './ecash-general-activity.component';

describe('EcashGeneralActivityComponent', () => {
	let component: EcashGeneralActivityComponent;
	let fixture: ComponentFixture<EcashGeneralActivityComponent>;

	const operation = new EcashOperation({
		id: 'op-1',
		mint_id: 'mint-1',
		type: WalletOperationType.Issue,
		state: WalletOperationState.Finalized,
		unit: 'sat',
		amount: 2100,
		memo: 'Meetup prizes',
		created_at: DateTime.now().toUnixInteger(),
		updated_at: 0,
	});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralActivityComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('operations', [operation]);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("lists today's operations under one group", () => {
		expect(component.groups().length).toBe(1);
		expect(component.groups()[0].rows.map((row) => row.title)).toEqual(['Issued']);
		expect(fixture.nativeElement.querySelector('.ecash-activity-row').textContent).toContain('Meetup prizes');
	});

	it('converts amounts at the oracle price only while the oracle is enabled', () => {
		fixture.componentRef.setInput('bitcoin_oracle_price', new BitcoinOraclePrice({date: 0, price: 100_000}));
		expect(component.groups()[0].rows[0].amount_oracle).toBeNull();
		fixture.componentRef.setInput('bitcoin_oracle_enabled', true);
		expect(component.groups()[0].rows[0].amount_oracle).toBe(210);
	});

	it('hands a clicked row and view all up', () => {
		const opened: EcashOperation[] = [];
		let viewed = false;
		component.open.subscribe((item) => opened.push(item));
		component.view_all.subscribe(() => (viewed = true));
		fixture.nativeElement.querySelector('.ecash-activity-row').click();
		fixture.nativeElement.querySelector('.ecash-activity-all button').click();
		expect(opened).toEqual([operation]);
		expect(viewed).toBeTrue();
	});

	it('shows placeholders while loading and a note when there is no activity', () => {
		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-animation-shimmer-high')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.ecash-activity-all')).toBeNull();

		fixture.componentRef.setInput('loading', false);
		fixture.componentRef.setInput('operations', []);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('No activity yet');
		expect(fixture.nativeElement.querySelector('.ecash-activity-all')).toBeNull();
	});
});
