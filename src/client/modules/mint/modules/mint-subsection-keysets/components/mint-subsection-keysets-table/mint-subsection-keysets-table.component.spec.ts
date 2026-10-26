/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
/* Native Dependencies */
import {OrcMintSubsectionKeysetsModule} from '@client/modules/mint/modules/mint-subsection-keysets/mint-subsection-keysets.module';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
/* Local Dependencies */
import {MintSubsectionKeysetsTableComponent} from './mint-subsection-keysets-table.component';

describe('MintSubsectionKeysetsTableComponent', () => {
	let component: MintSubsectionKeysetsTableComponent;
	let fixture: ComponentFixture<MintSubsectionKeysetsTableComponent>;

	const buildKeyset = (overrides: Partial<MintKeyset> = {}): MintKeyset =>
		new MintKeyset({
			id: '0187b2e8000000fe6074',
			active: true,
			derivation_path: "m/0'/0'/0'",
			derivation_path_index: 0,
			input_fee_ppk: 100,
			unit: 'sat',
			valid_from: 1777504327,
			valid_to: null,
			final_expiry: null,
			fees_paid: 199,
			amounts: [1, 2, 4, 8],
			...overrides,
		} as any);

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionKeysetsModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionKeysetsTableComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('keysets_analytics', []);
		fixture.componentRef.setInput('keysets_analytics_pre', []);
		fixture.componentRef.setInput('keysets_counts', []);
		fixture.componentRef.setInput('page_settings', {date_end: 2000000000, status: [], units: []});
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.componentRef.setInput('bitcoin_oracle_data', null);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders Created, Deactivated and Final expiry labels in the expanded detail', () => {
		fixture.componentRef.setInput('keysets', [buildKeyset()]);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Created');
		expect(text).toContain('Deactivated');
		expect(text).toContain('Final expiry');
	});

	it('shows the muted placeholder for null deactivation and final expiry', () => {
		fixture.componentRef.setInput('keysets', [buildKeyset({valid_from: 1777504327, valid_to: null, final_expiry: null})]);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('—');
		expect(text).not.toContain('MISSING');
	});

	it('renders the date fields below desktop (mobile first column)', () => {
		fixture.componentRef.setInput('device_type', 'mobile');
		fixture.componentRef.setInput('keysets', [buildKeyset()]);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Created');
		expect(text).toContain('Deactivated');
		expect(text).toContain('Final expiry');
	});

	it('shows MISSING when the created time is null', () => {
		fixture.componentRef.setInput('keysets', [buildKeyset({valid_from: null, valid_to: null, final_expiry: null})]);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent;
		expect(text).toContain('MISSING');
	});
	it('hides rotation controls for members on desktop and mobile', () => {
		fixture.componentRef.setInput('keysets', [buildKeyset()]);
		fixture.componentRef.setInput('loading', false);
		for (const device of ['desktop', 'mobile']) {
			fixture.componentRef.setInput('device_type', device);
			fixture.componentRef.setInput('allow_rotation', true);
			fixture.detectChanges();
			const rotationVisible = (): boolean =>
				device === 'desktop'
					? fixture.nativeElement.querySelector('[matTooltip="Rotate Keyset"]') !== null
					: fixture.nativeElement.textContent.includes('Rotate keyset');
			expect(rotationVisible()).toBeTrue();
			fixture.componentRef.setInput('allow_rotation', false);
			fixture.detectChanges();
			expect(rotationVisible()).toBeFalse();
		}
	});
	it('shows neutral unused member keysets on desktop and in phone details', () => {
		TestBed.inject(FederationService).mode.set('member');
		fixture.componentRef.setInput('keysets', [buildKeyset({valid_from: null})]);
		fixture.componentRef.setInput('loading', false);
		for (const device of ['desktop', 'mobile']) {
			fixture.componentRef.setInput('device_type', device);
			fixture.detectChanges();
			expect(fixture.nativeElement.textContent).toContain('Not used yet');
			expect(fixture.nativeElement.textContent).not.toContain('MISSING');
		}
	});
});
