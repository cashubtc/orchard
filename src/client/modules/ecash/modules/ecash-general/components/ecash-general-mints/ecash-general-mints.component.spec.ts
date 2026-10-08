/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
/* Local Dependencies */
import {EcashGeneralMintsComponent} from './ecash-general-mints.component';

describe('EcashGeneralMintsComponent', () => {
	let component: EcashGeneralMintsComponent;
	let fixture: ComponentFixture<EcashGeneralMintsComponent>;

	const mint = (id: string, name: string | null, url: string, is_orchard: boolean, created_at: number) =>
		new EcashMint({
			id,
			urls: [url],
			is_orchard,
			created_at,
			info: {name, nuts: {nut4: {disabled: false, methods: [{method: 'bolt11', unit: 'sat'}]}, nut5: {disabled: false, methods: []}}},
		});
	const mints = [
		mint('cedar', 'Cedar Community Mint', 'https://cedar.example', false, 1),
		mint('orchard', null, 'https://mint.orchard.example', true, 2),
	];

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('mints', mints);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lists the Orchard mint first, named by its host when it has no name', () => {
		expect(component.rows().map(({name, host, is_orchard}) => ({name, host, is_orchard}))).toEqual([
			{name: 'mint.orchard.example', host: 'mint.orchard.example', is_orchard: true},
			{name: 'Cedar Community Mint', host: 'cedar.example', is_orchard: false},
		]);
	});

	it('shows each mint checking until statuses load, then online or unreachable with the reason', () => {
		fixture.componentRef.setInput('loading_statuses', true);
		expect(component.rows().map((row) => row.status_text)).toEqual(['Checking', 'Checking']);

		fixture.componentRef.setInput('loading_statuses', false);
		fixture.componentRef.setInput('statuses', [
			new EcashMintStatus({mint_id: 'orchard', online: true, latency_ms: 12, error: null, checked_at: 0}),
			new EcashMintStatus({mint_id: 'cedar', online: false, latency_ms: null, error: 'connection refused', checked_at: 0}),
		]);
		expect(component.rows().map(({status, status_text, status_error}) => ({status, status_text, status_error}))).toEqual([
			{status: 'active', status_text: 'Online · 12 ms', status_error: null},
			{status: 'inactive', status_text: 'Unreachable', status_error: 'connection refused'},
		]);
	});

	it("shows each mint's own balances", () => {
		const orchard_balance = new EcashBalance({mint_id: 'orchard', unit: 'sat', balance: 2100});
		fixture.componentRef.setInput('balances', [orchard_balance, new EcashBalance({mint_id: 'cedar', unit: 'sat', balance: 0})]);
		expect(component.rows().map((row) => row.balances)).toEqual([[orchard_balance], []]);
	});
});
