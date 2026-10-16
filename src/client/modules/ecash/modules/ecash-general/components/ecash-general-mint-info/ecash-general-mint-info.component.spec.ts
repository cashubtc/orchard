/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralMintInfoComponent} from './ecash-general-mint-info.component';

describe('EcashGeneralMintInfoComponent', () => {
	let component: EcashGeneralMintInfoComponent;
	let fixture: ComponentFixture<EcashGeneralMintInfoComponent>;

	const info = (overrides: Partial<ConstructorParameters<typeof MintInfo>[0]> = {}) =>
		new MintInfo({
			name: 'Cedar Community Mint',
			pubkey: '02a9f3c7e41b8c81e',
			version: 'cdk-mintd/0.18.1',
			description: 'A neighborhood mint for the Cedar co-op.',
			motd: 'Maintenance window Sunday 02:00–03:00 UTC.',
			urls: ['https://mint.cedar.example', 'http://cedarmintq7v3xabcdefghij.onion'],
			contact: [
				{method: 'email', info: 'ops@cedar.example'},
				{method: 'signal', info: '+1 555 0100'},
			],
			nuts: {
				nut4: {
					disabled: false,
					methods: [
						{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
						{method: 'onchain', unit: 'sat', min_amount: 10000, max_amount: null, options: {confirmations: 3}},
						{method: 'bolt11', unit: 'usd', min_amount: 1, max_amount: 25000},
					],
				},
				nut5: {disabled: false, methods: [{method: 'bolt12', unit: 'sat'}]},
			},
			...overrides,
		});

	const text = () => fixture.nativeElement.textContent as string;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintInfoComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('info', info());
		fixture.componentRef.setInput('url', 'https://mint.cedar.example');
		fixture.componentRef.setInput('latency_ms', 84);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('summarizes the mint: name, host and version, status, description and its message', () => {
		expect(component.subtitle()).toBe('mint.cedar.example · cdk-mintd 0.18.1');
		expect(component.status_text()).toBe('Online · 84 ms');
		expect(text()).toContain('A neighborhood mint for the Cedar co-op.');
		expect(fixture.nativeElement.querySelector('[role="note"]').textContent).toContain('Maintenance window');
	});

	it('shows the status as a pill beside the name, or under it on mobile', () => {
		const header = () => fixture.nativeElement.querySelector('orc-ecash-general-mint-header');
		expect(header().querySelector(':scope > .orc-pill')).not.toBeNull();
		fixture.componentRef.setInput('device_type', 'mobile');
		fixture.detectChanges();
		expect(header().querySelector(':scope > .orc-pill')).toBeNull();
		expect(header().querySelector('.flex-column > [mint-header-detail]').textContent).toContain('Online · 84 ms');
	});

	it('names a Tor mint by its address type', () => {
		fixture.componentRef.setInput('url', 'http://cedarmintq7v3xabcdefghij.onion');
		expect(component.subtitle()).toBe('Tor address · cdk-mintd 0.18.1');
	});

	it('lists each unit and method once', () => {
		expect(component.unit_chips().map((chip) => chip.unit)).toEqual(['sat', 'usd']);
		expect(component.methods()).toEqual(['bolt11', 'onchain', 'bolt12']);
	});

	it('warns when the mint requires sign-in', () => {
		expect(component.sign_in_required()).toBeFalse();
		fixture.componentRef.setInput('info', info({nuts: {...info().nuts, nut22: {bat_max_mint: 50, protected_endpoints: []}}}));
		fixture.detectChanges();
		expect(component.sign_in_required()).toBeTrue();
		expect(text()).toContain('This mint requires sign-in');
	});

	it('reveals everything beyond the summary on toggle, keeping it out of reach while hidden', () => {
		const details = () => fixture.nativeElement.querySelector('.orc-animation-expand-collapse');
		expect(details().inert).toBeTrue();
		fixture.nativeElement.querySelector('.ecash-mint-info-toggle').click();
		fixture.detectChanges();
		expect(component.expanded()).toBeTrue();
		expect(details().inert).toBeFalse();
		expect(details().querySelector('orc-ecash-general-mint-details')).not.toBeNull();
		expect(text()).toContain('Hide details');
	});

	it('shows only the header when compact', () => {
		fixture.componentRef.setInput('compact', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.ecash-mint-info-toggle')).toBeNull();
		expect(text()).not.toContain('A neighborhood mint');
	});
});
