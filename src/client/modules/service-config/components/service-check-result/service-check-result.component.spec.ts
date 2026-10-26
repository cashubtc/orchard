import {Clipboard} from '@angular/cdk/clipboard';
import {TestBed} from '@angular/core/testing';
import {ServiceCheckResultComponent} from './service-check-result.component';

describe('ServiceCheckResultComponent', () => {
	it('renders the exact diagnostic as text with a copy action', () => {
		const copy = jasmine.createSpy().and.returnValue(true);
		TestBed.configureTestingModule({providers: [{provide: Clipboard, useValue: {copy}}]});
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: false,
			warning: false,
			title: 'Connection failed',
			context: 'localhost:1 · gRPC',
			diagnostic: 'connect ECONNREFUSED <127.0.0.1:1>',
			fields: ['host', 'port'],
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('pre').textContent).toBe('connect ECONNREFUSED <127.0.0.1:1>');
		expect(fixture.nativeElement.querySelector('button[aria-label="Copy diagnostic"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('.orc-error-card[role="alert"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('.result-icon').textContent).toBe('error');
		const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
		button.click();
		fixture.detectChanges();
		expect(copy).toHaveBeenCalledWith('connect ECONNREFUSED <127.0.0.1:1>');
		expect(fixture.nativeElement.querySelector('.copy-feedback[role="status"]').textContent).toContain('Diagnostic copied');
		copy.and.returnValue(false);
		button.click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.copy-feedback[role="alert"]').textContent).toContain('Could not copy');
	});

	it('styles a partial success as a warning, not a failure', () => {
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: true,
			warning: true,
			title: 'Mint RPC connected; database could not be opened',
			context: '',
			diagnostic: 'Unable to open database',
			fields: ['database'],
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-warning-card')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('.orc-error-card')).toBeNull();
	});

	it("renders the server's title and the exact diagnostic without reclassifying them", () => {
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: false,
			warning: false,
			saved: false,
			title: "Couldn't connect to the mint",
			context: 'mint:8086',
			diagnostic: '14 UNAVAILABLE: TLS certificate rejected',
			fields: ['cert'],
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('h3').textContent).toBe("Couldn't connect to the mint");
		expect(fixture.nativeElement.querySelector('pre').textContent).toBe('14 UNAVAILABLE: TLS certificate rejected');
	});
	it('formats Bitcoin details, member metadata and network matches without raw setup labels', () => {
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: true,
			warning: false,
			saved: true,
			title: 'Connection successful',
			context: '',
			fields: [],
			bitcoin_version: '28.1',
			bitcoin_blocks: 214880,
			chain: 'signet',
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Connection successful');
		expect(fixture.nativeElement.textContent).not.toContain('Saved and reconnected');
		expect(fixture.nativeElement.textContent).toContain('Bitcoin Core 28.1 · signet · block 214,880');
		fixture.componentRef.setInput('result', {
			ok: true,
			warning: false,
			saved: false,
			title: 'Connected',
			context: '',
			fields: [],
			mode: 'member',
			mint_member_id: 3,
			mint_member_count: 5,
			chain: 'signet',
			chain_match: true,
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Federation member 3 of 5');
		expect(fixture.nativeElement.textContent).toContain('Same network as your Bitcoin node: signet');
		fixture.componentRef.setInput('result', {
			ok: true,
			warning: false,
			saved: false,
			title: 'Connected',
			context: '',
			fields: [],
			mode: 'setup',
		});
		fixture.componentRef.setInput('note', 'This mint is in federation setup mode.');
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('Mint mode:');
		expect(fixture.nativeElement.textContent).toContain('This mint is in federation setup mode.');
		expect(fixture.nativeElement.querySelector('.result-icon').textContent).toBe('check_circle');
	});
});
