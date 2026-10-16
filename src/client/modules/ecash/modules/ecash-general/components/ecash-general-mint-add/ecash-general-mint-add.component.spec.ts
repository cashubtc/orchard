/* Core Dependencies */
import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
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
import {EcashMintLookup} from '@client/modules/ecash/classes/ecash-mint-lookup.class';
/* Shared Dependencies */
import {OrchardEcashMintLookup, WalletMintMatch} from '@shared/generated.types';
/* Local Dependencies */
import {EcashGeneralMintAddComponent} from './ecash-general-mint-add.component';

describe('EcashGeneralMintAddComponent', () => {
	let component: EcashGeneralMintAddComponent;
	let fixture: ComponentFixture<EcashGeneralMintAddComponent>;
	let ecash_service: {lookupMint: jasmine.Spy; addMint: jasmine.Spy};
	let active_events: Subject<EventData | null>;
	let event_service: {registerEvent: jasmine.Spy; getActiveEvent: () => Subject<EventData | null>};
	let panel_ref: {close: jasmine.Spy; setResult: jasmine.Spy};

	const nuts = {nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]}, nut5: {disabled: false, methods: []}};
	const kelp = new EcashMint({
		id: 'kelp',
		urls: ['https://kelp.example'],
		is_orchard: false,
		created_at: 0,
		info: {name: 'Kelp Mint', nuts},
	});
	const lookup = (overrides: Partial<OrchardEcashMintLookup> = {}) =>
		new EcashMintLookup({
			url: 'https://mint.cedar.example',
			latency_ms: 84,
			time_offset: 0,
			info: {name: 'Cedar Mint', nuts},
			...overrides,
		});

	const type = (url: string) => {
		component.form.controls.url.setValue(url);
		component.form.controls.url.markAsDirty();
	};

	beforeEach(async () => {
		ecash_service = {
			lookupMint: jasmine.createSpy('lookupMint').and.returnValue(of(lookup())),
			addMint: jasmine.createSpy('addMint').and.returnValue(of(kelp)),
		};
		active_events = new Subject<EventData | null>();
		event_service = {
			registerEvent: jasmine.createSpy('registerEvent').and.callFake((event: EventData) => active_events.next(event)),
			getActiveEvent: () => active_events,
		};
		panel_ref = {close: jasmine.createSpy('close'), setResult: jasmine.createSpy('setResult')};

		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: {mints: signal([kelp])}},
				{provide: FormPanelRef, useValue: panel_ref},
				{provide: EcashService, useValue: ecash_service},
				{provide: EventService, useValue: event_service},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintAddComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(component.state()).toBe('idle');
		expect(component.hint()).toBeNull();
	});

	it('looks a new mint up on blur, once per URL, and offers to add it', () => {
		type('https://mint.cedar.example');
		component.onBlur();
		component.onBlur();
		expect(ecash_service.lookupMint).toHaveBeenCalledOnceWith('https://mint.cedar.example');
		expect(component.state()).toBe('found');
		expect(component.hint()).toBe('Mint online. Review it before adding.');
		expect(component.can_add()).toBeTrue();
	});

	it('checks while the lookup runs, then shows the icon for what it found', () => {
		const pending = new Subject<EcashMintLookup>();
		ecash_service.lookupMint.and.returnValue(pending);
		type('https://mint.cedar.example');
		component.onLookup();
		expect(component.state()).toBe('loading');
		expect(component.status_icon()).toBeNull();
		pending.next(lookup());
		expect(component.state()).toBe('found');
		expect(component.status_icon()).toEqual({icon: 'check_circle', color: 'orc-status-active-color'});
	});

	it('drops a lookup still running once the URL is edited', () => {
		const pending = new Subject<EcashMintLookup>();
		ecash_service.lookupMint.and.returnValue(pending);
		type('https://mint.cedar.example');
		component.onLookup();
		type('https://mint.kelp.example');
		pending.next(lookup());
		expect(component.state()).toBe('idle');
		expect(component.can_add()).toBeFalse();
	});

	it("looks up a bare domain, but not text that isn't a mint address", () => {
		type('https://');
		component.onLookup();
		expect(ecash_service.lookupMint).not.toHaveBeenCalled();
		type('mint.cedar.example');
		component.onLookup();
		expect(ecash_service.lookupMint).toHaveBeenCalledOnceWith('mint.cedar.example');
	});

	it('looks up a local host on request, and on blur once it has a port', () => {
		type('cedar');
		component.onBlur();
		expect(ecash_service.lookupMint).not.toHaveBeenCalled();
		component.onLookup();
		expect(ecash_service.lookupMint).toHaveBeenCalledOnceWith('cedar');
		type('http://nutshell:3338');
		component.onBlur();
		expect(ecash_service.lookupMint).toHaveBeenCalledWith('http://nutshell:3338');
	});

	it("flags a mint that requires sign-in, and shows the server's refusal word for word", () => {
		ecash_service.lookupMint.and.returnValue(
			of(lookup({info: {nuts: {...nuts, nut21: {openid_discovery: 'x', client_id: 'y', protected_endpoints: []}}}})),
		);
		type('https://members.mint.example');
		component.onLookup();
		expect(component.state()).toBe('sign_in');
		expect(component.can_add()).toBeTrue();

		const errors = new OrchardErrors([{message: 'EcashWalletError', extensions: {code: 70001, details: 'getaddrinfo ENOTFOUND'}}]);
		ecash_service.lookupMint.and.returnValue(throwError(() => errors));
		type('https://mint.cedar.exmaple');
		component.onLookup();
		expect(component.state()).toBe('error');
		expect(component.error()).toBe('getaddrinfo ENOTFOUND');
		expect(component.form.controls.url.hasError('lookup')).toBeTrue();
		expect(component.can_lookup()).toBeTrue();
	});

	it('names the wallet mint a URL already is, or joins, and labels the action for it', () => {
		ecash_service.lookupMint.and.returnValue(of(lookup({info: null, match: WalletMintMatch.Url, mint_id: 'kelp'})));
		type('https://kelp.example');
		component.onLookup();
		expect(component.state()).toBe('exists');
		expect(component.can_add()).toBeFalse();

		ecash_service.lookupMint.and.returnValue(of(lookup({match: WalletMintMatch.Pubkey, mint_id: 'kelp'})));
		type('http://kelpmint.onion');
		component.onLookup();
		fixture.detectChanges();
		expect(component.state()).toBe('joins');
		expect(component.hint()).toBe('Mint online. This is another address for Kelp Mint.');
		expect(fixture.nativeElement.querySelector('.ecash-mint-add-submit').textContent).toContain('Add URL to Kelp Mint');
	});

	it('clears what was found once the URL is edited', () => {
		type('https://mint.cedar.example');
		component.onLookup();
		type('https://mint.cedar.example/v2');
		expect(component.state()).toBe('idle');
		expect(component.lookup()).toBeNull();
	});

	it('adds the mint by the URL it was looked up with, and closes with it once its success is on screen', () => {
		type('mint.cedar.example');
		component.onLookup();
		component.onSubmit();
		expect(ecash_service.addMint).toHaveBeenCalledWith('mint.cedar.example');
		expect(panel_ref.setResult).toHaveBeenCalledWith(kelp);
		expect(panel_ref.close).toHaveBeenCalled();
		expect(event_service.registerEvent.calls.mostRecent().args[0]).toEqual(
			jasmine.objectContaining({type: 'SUCCESS', message: 'Mint added'}),
		);
	});
});
