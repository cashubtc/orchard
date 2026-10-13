/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
/* Local Dependencies */
import {EcashGeneralMintChipComponent} from './ecash-general-mint-chip.component';

describe('EcashGeneralMintChipComponent', () => {
	let component: EcashGeneralMintChipComponent;
	let fixture: ComponentFixture<EcashGeneralMintChipComponent>;

	const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, '');

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintChipComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'mint',
			new EcashMint({
				id: 'mint-1',
				urls: ['https://mint.orchard.example'],
				is_orchard: true,
				created_at: 0,
				info: {name: 'e2e-nutshell', nuts: {nut4: {disabled: false, methods: []}, nut5: {disabled: false, methods: []}}},
			}),
		);
		fixture.componentRef.setInput('status', {state: 'active', text: 'Online · 7 ms', error: null});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('names the mint, with a status dot', () => {
		expect(text()).toBe('ENe2e-nutshell');
		expect(fixture.nativeElement.querySelector('orc-graphic-status')).not.toBeNull();
	});

	it('shows no status dot without a status', () => {
		fixture.componentRef.setInput('status', null);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('orc-graphic-status')).toBeNull();
	});

	it('says when the mint is unreachable, with the reason on hover', () => {
		fixture.componentRef.setInput('status', {state: 'inactive', text: 'Unreachable', error: 'connection refused'});
		fixture.detectChanges();
		expect(text()).toContain('Unreachable');
		expect(fixture.nativeElement.querySelector('orc-graphic-status').getAttribute('title')).toBe('connection refused');
	});

	it("shows the wallet's balance on the mint under its name", () => {
		fixture.componentRef.setInput('balance', 601);
		fixture.detectChanges();
		expect(text()).toContain('e2e-nutshell');
		expect(text()).toContain('Balance');
	});
});
