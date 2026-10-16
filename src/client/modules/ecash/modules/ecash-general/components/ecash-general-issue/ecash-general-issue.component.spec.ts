/* Core Dependencies */
import {WritableSignal, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {Subject, of, throwError} from 'rxjs';
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashIssuePanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {WalletOperationState, WalletOperationType} from '@shared/generated.types';
/* Local Dependencies */
import {EcashGeneralIssueComponent} from './ecash-general-issue.component';

describe('EcashGeneralIssueComponent', () => {
	let component: EcashGeneralIssueComponent;
	let fixture: ComponentFixture<EcashGeneralIssueComponent>;
	let ecash_service: {issueEcash: jasmine.Spy};
	let event_service: {registerEvent: jasmine.Spy; getActiveEvent: () => Subject<EventData | null>};
	let active_events: Subject<EventData | null>;
	let panel_ref: {close: jasmine.Spy; setResult: jasmine.Spy};

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
						{method: 'bolt11', unit: 'usd', min_amount: 100, max_amount: 500000},
						{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
						{method: 'bolt12', unit: 'eur'},
					],
				},
				nut5: {disabled: false, methods: []},
			},
		},
	});
	const balance = new EcashBalance({mint_id: 'mint-1', unit: 'sat', balance: 601});
	const reserves = new MintReserves({liabilities: [{unit: 'sat', amount: 12000}], sources: [], reserves: 50000, partial: false});
	const operation = new EcashOperation({
		id: 'op-1',
		mint_id: 'mint-1',
		type: WalletOperationType.Issue,
		state: WalletOperationState.Finalized,
		unit: 'sat',
		amount: 2100,
		created_at: 0,
		updated_at: 0,
	});

	let data: EcashIssuePanelData & {reserves: WritableSignal<MintReserves | null>};

	const configure = async (sheet: boolean, panel_mint: EcashMint = mint) => {
		data = {
			mint: panel_mint,
			reserves: signal<MintReserves | null>(reserves),
			status: signal({state: 'active', text: 'Online', error: null}),
			balances: signal([balance]),
			unit: null,
		};
		ecash_service = {issueEcash: jasmine.createSpy('issueEcash').and.returnValue(of(operation))};
		active_events = new Subject<EventData | null>();
		event_service = {
			registerEvent: jasmine.createSpy('registerEvent').and.callFake((event: EventData) => active_events.next(event)),
			getActiveEvent: () => active_events,
		};
		panel_ref = {close: jasmine.createSpy('close'), setResult: jasmine.createSpy('setResult')};

		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: data},
				{provide: FormPanelRef, useValue: panel_ref},
				{provide: EcashService, useValue: ecash_service},
				{provide: EventService, useValue: event_service},
				...(sheet ? [{provide: MatBottomSheetRef, useValue: {}}] : []),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralIssueComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	let in_sheet = false;
	let panel_mint = mint;

	beforeEach(() => configure(in_sheet, panel_mint));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('offers only the units the mint mints over bolt11, bitcoin first', () => {
		expect(component.units).toEqual(['sat', 'usd']);
		expect(component.unit()).toBe('sat');
	});

	it('opens in the unit the wallet has selected, when the mint issues in it', () => {
		data.unit = 'usd';
		expect(TestBed.createComponent(EcashGeneralIssueComponent).componentInstance.unit()).toBe('usd');
		data.unit = 'eur';
		expect(TestBed.createComponent(EcashGeneralIssueComponent).componentInstance.unit()).toBe('sat');
	});

	it("holds the amount to the mint's bolt11 limits for the unit, in display units", () => {
		component.form.controls.amount.setValue(600000);
		expect(component.form.controls.amount.errors).toEqual({max: {max: 500000, actual: 600000}});
		expect(component.can_submit()).toBeFalse();

		component.onUnit('usd');
		TestBed.tick();
		expect(component.amount()).toBeNull();
		component.form.controls.amount.setValue(0.5);
		expect(component.form.controls.amount.errors).toEqual({min: {min: 1, actual: 0.5}});
		component.form.controls.amount.setValue(12.5);
		expect(component.can_submit()).toBeTrue();
	});

	it('issues an amount entered in dollars as cents', () => {
		component.onUnit('usd');
		TestBed.tick();
		component.form.controls.amount.setValue(12.5);
		component.onSubmit();
		expect(ecash_service.issueEcash).toHaveBeenCalledWith('usd', 1250, null);
	});

	it('weighs the amount against the reserves, for bitcoin units only', () => {
		expect(component.solvency_reserves()).toBe(reserves);
		component.onUnit('usd');
		expect(component.solvency_reserves()).toBeNull();
	});

	it('picks up reserves that arrive after the panel opens', () => {
		data.reserves.set(null);
		expect(component.solvency_reserves()).toBeNull();
		data.reserves.set(reserves);
		expect(component.solvency_reserves()).toBe(reserves);
	});

	it("offers each unit the mint issues in with the wallet's balance there", () => {
		expect(component.unit_chips()).toEqual([
			{unit: 'sat', amount: 601},
			{unit: 'usd', amount: 0},
		]);
		expect(component.unit_balance()).toBe(601);
	});

	it('shows the typed amount in the hero and the issue button', () => {
		for (const key of ['2', '1', '0', '0']) component.onKey(key);
		fixture.detectChanges();
		expect(component.amount_text()).toBe('2100');
		expect(fixture.nativeElement.querySelector('.ecash-issue-submit').textContent).toContain('2,100');
	});

	it('builds the amount from keypad keys at the unit precision', () => {
		for (const key of ['2', '1', '.']) component.onKey(key);
		expect(component.amount()).toBe(21);

		component.onUnit('usd');
		for (const key of ['1', '2', '.', '5', '0', '9']) component.onKey(key);
		expect(component.amount()).toBe(12.5);
		expect(component.base_amount()).toBe(1250);
		component.onKey('backspace');
		component.onKey('backspace');
		expect(component.amount()).toBe(12);
	});

	it("warns of the mint's limit in the unit once the amount breaches it", () => {
		const hint = (): string => fixture.nativeElement.querySelector('.orc-error-color')?.textContent.replace(/\s+/g, '') ?? '';
		fixture.detectChanges();
		expect(hint()).toBe('');

		for (const key of ['6', '0', '0', '0', '0', '0']) component.onKey(key);
		fixture.detectChanges();
		expect(hint()).toBe('Cannotbegreaterthan₿500,000');
	});

	it('replaces the amount with pasted text, held to the unit precision', () => {
		component.onUnit('usd');
		component.onReplace('12.509');
		expect(component.amount_text()).toBe('12.50');
	});

	it('rejects an amount past the unit precision', () => {
		component.form.controls.amount.setValue(2.5);
		expect(component.form.controls.amount.errors).toEqual({orchardDecimals: {decimals: 0}});
	});

	it('issues the amount and closes with the operation', () => {
		component.form.controls.amount.setValue(2100);
		component.form.controls.memo.setValue(' Meetup prizes ');
		component.onSubmit();
		expect(ecash_service.issueEcash).toHaveBeenCalledWith('sat', 2100, 'Meetup prizes');
		expect(panel_ref.setResult).toHaveBeenCalledWith(operation);
		expect(panel_ref.close).toHaveBeenCalled();
		expect(event_service.registerEvent.calls.allArgs().map(([event]) => event.type)).toEqual(['SAVING', 'SUCCESS']);
		expect(event_service.registerEvent).toHaveBeenCalledWith(jasmine.objectContaining({type: 'SUCCESS', message: 'Ecash issued!'}));
	});

	it('closes without issuing', () => {
		component.onClose();
		expect(panel_ref.close).toHaveBeenCalledWith();
		expect(ecash_service.issueEcash).not.toHaveBeenCalled();
	});

	it('shows the memo field in the panel', () => {
		expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
	});

	it('says it is issuing while the request runs', () => {
		ecash_service.issueEcash.and.returnValue(new Subject());
		for (const key of ['2', '1', '0', '0']) component.onKey(key);
		component.onSubmit();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.ecash-issue-submit').textContent.replace(/\s+/g, '')).toBe('Issuing₿2,100…');
	});

	it('locks the amount, unit and memo while issuing, and unlocks them on a refusal', () => {
		const response = new Subject<EcashOperation>();
		ecash_service.issueEcash.and.returnValue(response);
		for (const key of ['2', '1']) component.onKey(key);
		component.onSubmit();

		component.onKey('5');
		component.onUnit('usd');
		expect(component.amount_text()).toBe('21');
		expect(component.unit()).toBe('sat');
		expect(component.form.controls.memo.disabled).toBeTrue();

		response.error(new OrchardErrors([{message: 'EcashWalletError', extensions: {code: 70001, details: 'mint offline'}}]));
		expect(component.form.controls.memo.enabled).toBeTrue();
		component.onKey('5');
		expect(component.amount_text()).toBe('215');
	});

	it("stays open with the inputs when the server refuses, showing the server's message", () => {
		const errors = new OrchardErrors([{message: 'EcashWalletError', extensions: {code: 70001, details: 'quote expired'}}]);
		ecash_service.issueEcash.and.returnValue(throwError(() => errors));
		component.form.controls.amount.setValue(2100);
		component.onSubmit();
		expect(panel_ref.close).not.toHaveBeenCalled();
		expect(component.submitting()).toBeFalse();
		expect(component.amount()).toBe(2100);
		expect(event_service.registerEvent.calls.allArgs().map(([event]) => event.type)).toEqual(['SAVING', 'ERROR']);
		expect(event_service.registerEvent).toHaveBeenCalledWith(
			jasmine.objectContaining({type: 'ERROR', message: errors.errors[0].getFullError()}),
		);
	});

	it('hands back the operation at once, but closes only once its success is on screen', () => {
		event_service.registerEvent.and.stub();
		component.form.controls.amount.setValue(2100);
		component.onSubmit();
		expect(panel_ref.setResult).toHaveBeenCalledWith(operation);
		expect(panel_ref.close).not.toHaveBeenCalled();

		active_events.next(event_service.registerEvent.calls.mostRecent().args[0]);
		expect(panel_ref.close).toHaveBeenCalled();
	});

	it("warns of the mint's minimum in the unit", () => {
		component.onUnit('usd');
		for (const key of ['0', '.', '5']) component.onKey(key);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-error-color').textContent).toContain('Must be at least');
	});

	it('notes that assets are only tracked for bitcoin units', () => {
		component.onUnit('usd');
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Assets only tracked for bitcoin');
	});

	describe('in a bottom sheet', () => {
		beforeAll(() => (in_sheet = true));
		afterAll(() => (in_sheet = false));

		it('folds the memo away until its toggle opens and focuses it', () => {
			const memo = fixture.nativeElement.querySelector('textarea');
			expect(memo.closest('.orc-animation-expand-collapse').inert).toBeTrue();

			component.onToggleMemo();
			fixture.detectChanges();
			TestBed.tick();
			expect(memo.closest('.orc-animation-expand-collapse').inert).toBeFalse();
			expect(document.activeElement).toBe(memo);
		});

		it('takes the amount from the keypad and the unit from the picker, with a collapsible balance sheet', () => {
			expect(fixture.nativeElement.querySelector('orc-form-keypad')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('orc-ecash-general-unit-picker')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('.ecash-solvency-toggle')).not.toBeNull();
		});

		it('closes from its close button without issuing', () => {
			fixture.nativeElement.querySelector('button[aria-label="Close"]').click();
			expect(panel_ref.close).toHaveBeenCalledWith();
			expect(ecash_service.issueEcash).not.toHaveBeenCalled();
		});

		describe('for a mint that issues in one unit', () => {
			beforeAll(
				() =>
					(panel_mint = new EcashMint({
						id: 'mint-1',
						urls: ['https://mint.orchard.example'],
						is_orchard: true,
						created_at: 0,
						info: {
							name: 'Orchard Mint',
							nuts: {
								nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]},
								nut5: {disabled: false, methods: []},
							},
						},
					})),
			);
			afterAll(() => (panel_mint = mint));

			it('offers no unit picker', () => {
				expect(fixture.nativeElement.querySelector('orc-ecash-general-unit-picker')).toBeNull();
			});
		});
	});
});
