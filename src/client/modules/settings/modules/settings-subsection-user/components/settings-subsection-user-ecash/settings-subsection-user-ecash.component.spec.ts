/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
/* Native Dependencies */
import {OrcSettingsSubsectionUserModule} from '@client/modules/settings/modules/settings-subsection-user/settings-subsection-user.module';
/* Local Dependencies */
import {SettingsSubsectionUserEcashComponent} from './settings-subsection-user-ecash.component';

describe('SettingsSubsectionUserEcashComponent', () => {
	let component: SettingsSubsectionUserEcashComponent;
	let fixture: ComponentFixture<SettingsSubsectionUserEcashComponent>;

	const mint = (id: string, urls: string[]) => new EcashMint({id, urls, is_orchard: false, created_at: 0, info: null});
	const testid = (id: string): HTMLElement => fixture.nativeElement.querySelector(`[data-testid="settings-subsection-user-ecash-${id}"]`);

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcSettingsSubsectionUserModule],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionUserEcashComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('seed', new EcashSeed({created_at: 1, backed_up_at: null}));
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('asks for a backup while the words were never written down', () => {
		expect(testid('status').textContent).toContain('Not backed up');
		expect(testid('backup').textContent).toContain('Back up');
		const asked = jasmine.createSpy('backup');
		component.backup.subscribe(asked);
		testid('backup').click();
		expect(asked).toHaveBeenCalledTimes(1);
	});

	it('offers to show the words again once backed up, with the backup date', () => {
		fixture.componentRef.setInput('seed', new EcashSeed({created_at: 1, backed_up_at: 1_792_000_000}));
		fixture.detectChanges();
		expect(testid('status').textContent).toContain('Backed up');
		expect(testid('status').textContent).not.toContain('Not');
		expect(testid('backup').textContent).toContain('Show words');
	});

	it('shows the mint URLs a restore needs', () => {
		fixture.componentRef.setInput('mints', [
			mint('kelp', ['https://kelp.example', 'http://kelp.onion']),
			mint('cedar', ['https://cedar.example']),
		]);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('2 mint URLs');
	});

	it('leaves the mint URLs out when no mint has a public URL', () => {
		fixture.componentRef.setInput('mints', [mint('orchard', [])]);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('orc-ecash-general-restore-urls')).toBeNull();
	});

	it('gives the action its own full-width row on a phone', () => {
		expect(testid('backup').classList).not.toContain('w-full');
		fixture.componentRef.setInput('device_type', 'mobile');
		fixture.detectChanges();
		expect(testid('backup').classList).toContain('w-full');
	});
});
