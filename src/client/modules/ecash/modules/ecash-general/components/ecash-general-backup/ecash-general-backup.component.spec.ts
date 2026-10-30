/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {of, throwError} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashBackupPanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Local Dependencies */
import {EcashGeneralBackupComponent} from './ecash-general-backup.component';

describe('EcashGeneralBackupComponent', () => {
	let component: EcashGeneralBackupComponent;
	let fixture: ComponentFixture<EcashGeneralBackupComponent>;
	let ecash_service: {revealSeed: jasmine.Spy; backupSeed: jasmine.Spy};
	let event_service: {registerEvent: jasmine.Spy};
	let panel_ref: {close: jasmine.Spy; setResult: jasmine.Spy};

	const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
	const mint = (id: string, urls: string[]) => new EcashMint({id, urls, is_orchard: false, created_at: 0, info: null});
	const mints = [mint('kelp', ['https://kelp.example', 'http://kelp.onion']), mint('cedar', ['https://cedar.example'])];

	const create = async (seed: EcashSeed | null, wallet_mints: EcashMint[] = mints) => {
		const data: EcashBackupPanelData = {seed, mints: wallet_mints};
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{provide: FORM_PANEL_DATA, useValue: data},
				{provide: FormPanelRef, useValue: panel_ref},
				{provide: EcashService, useValue: ecash_service},
				{provide: EventService, useValue: event_service},
			],
		}).compileComponents();
		fixture = TestBed.createComponent(EcashGeneralBackupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};

	const reveal = () => {
		component.form.controls.password.setValue('secret');
		component.onSubmit();
		fixture.detectChanges();
	};

	const testid = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="ecash-general-backup-${id}"]`);

	beforeEach(() => {
		ecash_service = {
			revealSeed: jasmine.createSpy('revealSeed').and.returnValue(of(mnemonic)),
			backupSeed: jasmine.createSpy('backupSeed').and.returnValue(of(new EcashSeed({created_at: 1, backed_up_at: 1_792_000_000}))),
		};
		event_service = {registerEvent: jasmine.createSpy('registerEvent')};
		panel_ref = {close: jasmine.createSpy('close'), setResult: jasmine.createSpy('setResult')};
	});

	it('should create on the password step, waiting for a password', async () => {
		await create(new EcashSeed({created_at: 1, backed_up_at: null}));
		expect(component).toBeTruthy();
		expect(component.step()).toBe('password');
		expect(component.submit_label()).toBe('Show recovery words');
		expect(component.can_submit()).toBeFalse();
		component.form.controls.password.setValue('secret');
		expect(component.can_submit()).toBeTrue();
	});

	it('shows the twelve words for the right password and forgets the password', async () => {
		await create(new EcashSeed({created_at: 1, backed_up_at: null}));
		reveal();
		expect(ecash_service.revealSeed).toHaveBeenCalledOnceWith('secret');
		expect(component.step()).toBe('words');
		expect(component.form.controls.password.value).toBe('');
		expect(testid('words')?.querySelectorAll('li').length).toBe(12);
		expect(testid('words')?.textContent).toContain('abandon');
	});

	it('moves focus to the instructions as the words replace the password field', async () => {
		await create(null);
		reveal();
		expect(document.activeElement?.textContent).toContain('Write these 12 words on paper');
	});

	it('keeps Done disabled until the words are written down, then records the backup and clears them', async () => {
		await create(new EcashSeed({created_at: 1, backed_up_at: null}));
		reveal();
		expect(testid('written')).not.toBeNull();
		expect(component.submit_label()).toBe('Done');
		expect(component.can_submit()).toBeFalse();
		component.written.set(true);
		component.onSubmit();
		fixture.detectChanges();
		expect(ecash_service.backupSeed).toHaveBeenCalledTimes(1);
		expect(panel_ref.setResult).toHaveBeenCalledWith(jasmine.objectContaining({backed_up_at: 1_792_000_000}));
		expect(component.step()).toBe('done');
		expect(component.words()).toEqual([]);
		expect(testid('written')).toBeNull();
		expect(panel_ref.close).not.toHaveBeenCalled();
		component.onSubmit();
		expect(panel_ref.close).toHaveBeenCalled();
	});

	it('says why a wrong password is refused and clears the message on the next keystroke', async () => {
		await create(null);
		const errors = new OrchardErrors([{message: 'InvalidPasswordError', extensions: {code: 10008}}]);
		ecash_service.revealSeed.and.returnValue(throwError(() => errors));
		reveal();
		expect(component.step()).toBe('password');
		expect(component.error()).toBe('That password doesn’t match your account.');
		expect(component.words()).toEqual([]);
		component.form.controls.password.setValue('secret2');
		expect(component.error()).toBeNull();
	});

	it('only shows the words again once backed up, closing without a second backup', async () => {
		await create(new EcashSeed({created_at: 1, backed_up_at: 1_700_000_000}));
		reveal();
		expect(component.reshow).toBeTrue();
		expect(testid('written')).toBeNull();
		expect(component.submit_label()).toBe('Close');
		expect(component.can_submit()).toBeTrue();
		component.onSubmit();
		expect(ecash_service.backupSeed).not.toHaveBeenCalled();
		expect(panel_ref.setResult).not.toHaveBeenCalled();
		expect(panel_ref.close).toHaveBeenCalled();
	});

	it('shows the wallet mints a restore needs beside the words', async () => {
		await create(null);
		reveal();
		expect(fixture.nativeElement.textContent).toContain('2 mint URLs');
	});

	it('leaves the mint URLs out when no wallet mint has a public URL', async () => {
		await create(null, [mint('orchard', [])]);
		reveal();
		expect(fixture.nativeElement.querySelector('orc-ecash-general-restore-urls')).toBeNull();
	});

	it('reports a failed backup and stays on the words', async () => {
		await create(null);
		ecash_service.backupSeed.and.returnValue(
			throwError(() => new OrchardErrors([{message: 'EcashWalletError', extensions: {code: 70001, details: 'database is locked'}}])),
		);
		reveal();
		component.written.set(true);
		component.onSubmit();
		expect(event_service.registerEvent).toHaveBeenCalledWith(
			jasmine.objectContaining({type: 'ERROR', message: 'database is locked : 70001'}),
		);
		expect(component.step()).toBe('words');
		expect(component.words().length).toBe(12);
		expect(component.can_submit()).toBeTrue();
	});
});
