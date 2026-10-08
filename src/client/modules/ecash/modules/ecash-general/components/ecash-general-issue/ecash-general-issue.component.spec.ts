/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {of, throwError} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
/* Shared Dependencies */
import {WalletOperationState, WalletOperationType} from '@shared/generated.types';
/* Local Dependencies */
import {EcashGeneralIssueComponent} from './ecash-general-issue.component';

describe('EcashGeneralIssueComponent', () => {
	let component: EcashGeneralIssueComponent;
	let fixture: ComponentFixture<EcashGeneralIssueComponent>;
	let ecash_service: {issueEcash: jasmine.Spy};
	let event_service: {registerEvent: jasmine.Spy};
	let panel_ref: {close: jasmine.Spy};

	const mint = new EcashMint({
		id: 'mint-1',
		urls: ['https://mint.orchard.example'],
		is_orchard: true,
		created_at: 0,
		info: {
			name: 'Orchard Mint',
			nuts: {
				nut4: {
					disabled: false,
					methods: [
						{method: 'bolt11', unit: 'usd'},
						{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
						{method: 'bolt12', unit: 'eur'},
					],
				},
				nut5: {disabled: false, methods: []},
			},
		},
	});
	const reserves = new MintReserves({liabilities: [{unit: 'sat', amount: 12000}], sources: [], reserves: 50000, partial: false});
	const operation = new EcashOperation({
		id: 'op-1',
		mint_id: 'mint-1',
		type: WalletOperationType.Mint,
		state: WalletOperationState.Finalized,
		unit: 'sat',
		amount: 2100,
		created_at: 0,
		updated_at: 0,
	});

	beforeEach(async () => {
		ecash_service = {issueEcash: jasmine.createSpy('issueEcash').and.returnValue(of(operation))};
		event_service = {registerEvent: jasmine.createSpy('registerEvent')};
		panel_ref = {close: jasmine.createSpy('close')};

		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: {mint}},
				{provide: FormPanelRef, useValue: panel_ref},
				{provide: EcashService, useValue: ecash_service},
				{provide: MintService, useValue: {loadMintReserves: () => of(reserves)}},
				{provide: EventService, useValue: event_service},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralIssueComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('offers only the units the mint mints over bolt11, bitcoin first', () => {
		expect(component.units).toEqual(['sat', 'usd']);
		expect(component.unit()).toBe('sat');
	});

	it("holds the amount to the mint's bolt11 limits for the unit", () => {
		component.form.controls.amount.setValue(600000);
		expect(component.form.controls.amount.errors).toEqual({max: {max: 500000, actual: 600000}});
		expect(component.can_submit()).toBeFalse();

		component.unit.set('usd');
		TestBed.tick();
		expect(component.form.controls.amount.errors).toBeNull();
		expect(component.can_submit()).toBeTrue();
	});

	it('shows the balance sheet before and after the amount', () => {
		component.form.controls.amount.setValue(13000);
		const preview = component.preview();
		expect(preview).toEqual(
			jasmine.objectContaining({liabilities_before: 12000, liabilities_after: 25000, reserves: 50000, coverage_after: 2}),
		);
		expect(preview?.coverage_before).toBeCloseTo(4.1667);
	});

	it('has no balance sheet preview for units reserves do not back', () => {
		component.unit.set('usd');
		expect(component.preview()).toBeNull();
	});

	it('builds the amount from keypad digits and drops the last one on backspace', () => {
		component.onDigit('0');
		expect(component.amount()).toBeNull();
		component.onDigit('2');
		component.onDigit('1');
		expect(component.amount()).toBe(21);
		component.onBackspace();
		expect(component.amount()).toBe(2);
	});

	it('issues the amount and closes with the operation', () => {
		component.form.controls.amount.setValue(2100);
		component.form.controls.memo.setValue(' Meetup prizes ');
		component.onSubmit();
		expect(ecash_service.issueEcash).toHaveBeenCalledWith('sat', 2100, 'Meetup prizes');
		expect(panel_ref.close).toHaveBeenCalledWith(operation);
		expect(event_service.registerEvent).toHaveBeenCalledWith(jasmine.objectContaining({type: 'SUCCESS', message: 'Ecash issued!'}));
	});

	it("stays open with the inputs when the server refuses, showing the server's message", () => {
		const errors = new OrchardErrors([{message: 'EcashWalletError', extensions: {code: 70001, details: 'quote expired'}}]);
		ecash_service.issueEcash.and.returnValue(throwError(() => errors));
		component.form.controls.amount.setValue(2100);
		component.onSubmit();
		expect(panel_ref.close).not.toHaveBeenCalled();
		expect(component.submitting()).toBeFalse();
		expect(component.amount()).toBe(2100);
		expect(event_service.registerEvent).toHaveBeenCalledWith(
			jasmine.objectContaining({type: 'ERROR', message: errors.errors[0].getFullError()}),
		);
	});
});
