/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {of} from 'rxjs';
/* Application Dependencies */
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashGeneralBackupComponent} from '@client/modules/ecash/modules/ecash-general/components/ecash-general-backup/ecash-general-backup.component';
/* Native Dependencies */
import {OrcSettingsSubsectionUserModule} from '@client/modules/settings/modules/settings-subsection-user/settings-subsection-user.module';
/* Local Dependencies */
import {SettingsSubsectionUserComponent} from './settings-subsection-user.component';

describe('SettingsSubsectionUserComponent', () => {
	let component: SettingsSubsectionUserComponent;
	let fixture: ComponentFixture<SettingsSubsectionUserComponent>;
	let ecash_service: {loadSeed: jasmine.Spy; loadBalances: jasmine.Spy; loadMints: jasmine.Spy};
	let form_panel_service: {open: jasmine.Spy};

	const mints = [new EcashMint({id: 'kelp', urls: ['https://kelp.example'], is_orchard: false, created_at: 0, info: null})];
	const balance = (amount: number) => new EcashBalance({mint_id: 'kelp', unit: 'sat', balance: amount});
	const seed = (backed_up_at: number | null) => new EcashSeed({created_at: 1, backed_up_at});
	const card = (): HTMLElement | null => fixture.nativeElement.querySelector('orc-settings-subsection-user-ecash');

	const create = async (backed_up_at: number | null, amount: number) => {
		ecash_service = {
			loadSeed: jasmine.createSpy('loadSeed').and.returnValue(of(seed(backed_up_at))),
			loadBalances: jasmine.createSpy('loadBalances').and.returnValue(of([balance(amount)])),
			loadMints: jasmine.createSpy('loadMints').and.returnValue(of(mints)),
		};
		form_panel_service = {open: jasmine.createSpy('open')};
		await TestBed.configureTestingModule({
			imports: [OrcSettingsSubsectionUserModule],
			providers: [
				{provide: EcashService, useValue: ecash_service},
				{provide: FormPanelService, useValue: form_panel_service},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionUserComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	it('should create', async () => {
		await create(null, 0);
		expect(component).toBeTruthy();
	});

	it('hides the wallet card until the wallet holds ecash', async () => {
		await create(null, 0);
		expect(component.ecash_visible()).toBeFalse();
		expect(card()).toBeNull();
	});

	it('shows the wallet card once the wallet holds ecash', async () => {
		await create(null, 2100);
		expect(component.ecash_visible()).toBeTrue();
		expect(card()).not.toBeNull();
	});

	it('keeps the wallet card once backed up, even when the wallet is empty', async () => {
		await create(1_792_000_000, 0);
		expect(component.ecash_visible()).toBeTrue();
	});

	it('opens the backup panel with the seed and mints, and takes the confirmed backup', async () => {
		await create(null, 2100);
		form_panel_service.open.and.returnValue({afterClosed: () => of(seed(1_792_000_000))});
		component.onEcashBackup();
		const [panel, {data}] = form_panel_service.open.calls.mostRecent().args;
		expect(panel).toBe(EcashGeneralBackupComponent);
		expect(data).toEqual({seed: seed(null), mints});
		expect(component.ecash_seed()?.backed_up_at).toBe(1_792_000_000);
	});
});
