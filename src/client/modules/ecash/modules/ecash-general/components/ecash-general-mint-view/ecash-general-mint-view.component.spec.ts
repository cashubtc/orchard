/* Core Dependencies */
import {WritableSignal, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Clipboard} from '@angular/cdk/clipboard';
import {HttpErrorResponse} from '@angular/common/http';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
import {DateTime} from 'luxon';
import {Subject, of, throwError} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashMintStatusPill, EcashMintViewPanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {OrchardEcashMint} from '@shared/generated.types';
/* Local Dependencies */
import {EcashGeneralMintViewComponent} from './ecash-general-mint-view.component';

describe('EcashGeneralMintViewComponent', () => {
	let component: EcashGeneralMintViewComponent;
	let fixture: ComponentFixture<EcashGeneralMintViewComponent>;
	let mint: WritableSignal<EcashMint>;
	let balances: WritableSignal<EcashBalance[]>;
	let pill: WritableSignal<EcashMintStatusPill>;
	let refreshed: jasmine.Spy;
	let ecash_service: {refreshMint: jasmine.Spy; removeMint: jasmine.Spy};
	let active_events: Subject<EventData | null>;
	let event_service: {registerEvent: jasmine.Spy; getActiveEvent: () => Subject<EventData | null>};
	let panel_ref: {close: jasmine.Spy; setResult: jasmine.Spy};
	let clipboard: {copy: jasmine.Spy};
	let dialog: {open: jasmine.Spy};

	const nuts = {nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]}, nut5: {disabled: false, methods: []}};
	const cedar = (overrides: Partial<OrchardEcashMint> = {}) =>
		new EcashMint({
			id: 'cedar',
			urls: ['https://mint.cedar.example'],
			is_orchard: false,
			created_at: 1_792_000_000,
			info: {name: 'Cedar Mint', version: 'cdk-mintd/0.18.1', nuts},
			...overrides,
		});
	const status = new EcashMintStatus({mint_id: 'cedar', online: true, latency_ms: 40, error: null, checked_at: 0});

	const text = () => fixture.nativeElement.textContent as string;
	const button = (label: string): HTMLButtonElement =>
		[...fixture.nativeElement.querySelectorAll('button')].find((item: HTMLButtonElement) => item.textContent?.includes(label));

	beforeEach(async () => {
		mint = signal(cedar());
		balances = signal<EcashBalance[]>([]);
		pill = signal<EcashMintStatusPill>({state: 'active', text: 'Online · 84 ms', error: null});
		refreshed = jasmine.createSpy('refreshed');
		const data: EcashMintViewPanelData = {
			mint,
			status: pill,
			checked_at: signal(DateTime.now().toUnixInteger()),
			balances,
			refreshed,
		};
		ecash_service = {
			refreshMint: jasmine.createSpy('refreshMint').and.returnValue(of(status)),
			removeMint: jasmine.createSpy('removeMint').and.returnValue(of(true)),
		};
		active_events = new Subject<EventData | null>();
		event_service = {
			registerEvent: jasmine.createSpy('registerEvent').and.callFake((event: EventData) => active_events.next(event)),
			getActiveEvent: () => active_events,
		};
		panel_ref = {close: jasmine.createSpy('close'), setResult: jasmine.createSpy('setResult')};
		clipboard = {copy: jasmine.createSpy('copy').and.returnValue(true)};
		dialog = {open: jasmine.createSpy('open')};

		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: data},
				{provide: FormPanelRef, useValue: panel_ref},
				{provide: EcashService, useValue: ecash_service},
				{provide: EventService, useValue: event_service},
				{provide: Clipboard, useValue: clipboard},
				{provide: MatDialog, useValue: dialog},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(component.subtitle()).toBe('mint.cedar.example · cdk-mintd 0.18.1');
		expect(text()).toContain('Online · 84 ms');
		expect(text()).toContain('Info checked just now');
	});

	it('shows only what the wallet holds at the mint, and nothing when it holds none', () => {
		const held = () => fixture.nativeElement.querySelector('[data-testid="ecash-general-mint-view-held"]');
		balances.set([new EcashBalance({mint_id: 'cedar', unit: 'usd', balance: 0})]);
		fixture.detectChanges();
		expect(held()).toBeNull();
		balances.set([
			new EcashBalance({mint_id: 'cedar', unit: 'sat', balance: 601}),
			new EcashBalance({mint_id: 'cedar', unit: 'usd', balance: 0}),
		]);
		fixture.detectChanges();
		expect(component.held()).toEqual([{unit: 'sat', amount: 601}]);
		expect(held()).not.toBeNull();
	});

	it('shows why an unreachable mint could not be reached', () => {
		const error = () => fixture.nativeElement.querySelector('[data-testid="ecash-general-mint-view-error"]');
		expect(error()).toBeNull();
		pill.set({state: 'inactive', text: 'Unreachable', error: 'https://mint.cedar.example/v1/info: ECONNREFUSED'});
		fixture.detectChanges();
		expect(error().textContent).toContain('ECONNREFUSED');
	});

	it('copies the URL and shows it as a QR code', () => {
		button('Copy URL').click();
		fixture.detectChanges();
		expect(clipboard.copy).toHaveBeenCalledWith('https://mint.cedar.example');
		expect(text()).toContain('Copied');
		button('QR code').click();
		expect(dialog.open.calls.mostRecent().args[1].data).toEqual(
			jasmine.objectContaining({title: 'Cedar Mint', data: 'https://mint.cedar.example'}),
		);
	});

	it('offers no copy or QR code for a mint without a public URL', () => {
		mint.set(cedar({urls: []}));
		fixture.detectChanges();
		expect(button('Copy URL').disabled).toBeTrue();
		expect(button('QR code').disabled).toBeTrue();
		expect(fixture.nativeElement.querySelector('.orc-status-warning-color')?.textContent).toBe('No public URL');
	});

	it('refreshes the mint and hands the fresh status to the page', () => {
		button('Refresh').click();
		expect(ecash_service.refreshMint).toHaveBeenCalledOnceWith('cedar');
		expect(refreshed).toHaveBeenCalledOnceWith(status);
		expect(component.refreshing()).toBeFalse();
	});

	it("shows a failed refresh's own message", () => {
		const errors = new OrchardErrors([
			{message: 'EcashWalletError', extensions: {code: 70001, details: 'Mint not found in this wallet'}},
		]);
		ecash_service.refreshMint.and.returnValue(throwError(() => errors));
		button('Refresh').click();
		expect(refreshed).not.toHaveBeenCalled();
		expect(event_service.registerEvent.calls.mostRecent().args[0]).toEqual(
			jasmine.objectContaining({type: 'ERROR', message: jasmine.stringContaining('Mint not found in this wallet')}),
		);
		expect(component.refreshing()).toBeFalse();
	});

	it("explains a request that never reached Orchard's server, ending the saving state", () => {
		const offline = new HttpErrorResponse({status: 0, statusText: 'Unknown Error'});
		ecash_service.refreshMint.and.returnValue(throwError(() => offline));
		button('Refresh').click();
		expect(event_service.registerEvent.calls.mostRecent().args[0]).toEqual(
			jasmine.objectContaining({type: 'ERROR', message: jasmine.stringContaining('did not respond')}),
		);

		ecash_service.removeMint.and.returnValue(throwError(() => offline));
		button('Remove mint').click();
		fixture.detectChanges();
		button('Remove').click();
		const types = event_service.registerEvent.calls.allArgs().map(([event]) => event.type);
		expect(types.slice(-2)).toEqual(['SAVING', 'ERROR']);
		expect(component.removing()).toBeFalse();
		expect(panel_ref.close).not.toHaveBeenCalled();
	});

	it("explains a mint that can't be removed", () => {
		balances.set([new EcashBalance({mint_id: 'cedar', unit: 'sat', balance: 601})]);
		fixture.detectChanges();
		const note = () => fixture.nativeElement.querySelector('[data-testid="ecash-general-mint-view-remove-note"]').textContent.trim();
		expect(button('Remove mint').disabled).toBeTrue();
		expect(note()).toBe('Holds ecash. Spend or move it first.');
		mint.set(cedar({is_orchard: true}));
		fixture.detectChanges();
		expect(note()).toBe('The Orchard mint stays in every wallet.');
	});

	it('confirms before removing, focusing Cancel, then closes once the removal shows', async () => {
		button('Remove mint').click();
		fixture.detectChanges();
		await fixture.whenStable();
		expect(text()).toContain('Remove Cedar Mint?');
		expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
		button('Remove').click();
		expect(ecash_service.removeMint).toHaveBeenCalledOnceWith('cedar');
		expect(panel_ref.setResult).toHaveBeenCalledOnceWith(true);
		expect(panel_ref.close).toHaveBeenCalled();
	});

	it('returns focus to Remove mint when the removal is called off', async () => {
		button('Remove mint').click();
		fixture.detectChanges();
		button('Cancel').click();
		fixture.detectChanges();
		await fixture.whenStable();
		expect(component.confirming()).toBeFalse();
		expect(document.activeElement?.textContent).toContain('Remove mint');
	});

	it('backs out of the confirm alone on Escape, keeping the panel open', async () => {
		const outside = jasmine.createSpy('outside keydown');
		fixture.nativeElement.addEventListener('keydown', outside);
		button('Remove mint').click();
		fixture.detectChanges();
		const confirm = fixture.nativeElement.querySelector('[data-testid="ecash-general-mint-view-confirm"]');
		confirm.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
		fixture.detectChanges();
		await fixture.whenStable();
		expect(component.confirming()).toBeFalse();
		expect(outside).not.toHaveBeenCalled();
		expect(document.activeElement?.textContent).toContain('Remove mint');
	});

	it("explains a mint whose info hasn't loaded", () => {
		mint.set(cedar({info: null}));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('orc-ecash-general-mint-info')).toBeNull();
		expect(text()).toContain('hasn’t loaded this mint’s info yet');
	});
});
