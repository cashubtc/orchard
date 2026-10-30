/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {formatOrchardError} from '@client/modules/error/helpers/error.helpers';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBackupPanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
import {getMintRestoreUrls} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

/** Where the backup panel stands */
type EcashBackupStep = 'password' | 'words' | 'done';

@Component({
	selector: 'orc-ecash-general-backup',
	standalone: false,
	templateUrl: './ecash-general-backup.component.html',
	styleUrl: './ecash-general-backup.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralBackupComponent {
	private readonly ecashService = inject(EcashService);
	private readonly eventService = inject(EventService);
	private readonly panelRef = inject(FormPanelRef);
	private readonly destroyRef = inject(DestroyRef);
	public readonly data: EcashBackupPanelData = inject(FORM_PANEL_DATA);

	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;
	/** The wallet was backed up before, so the words are only shown again */
	public readonly reshow: boolean = !!this.data.seed?.backed_up_at;
	/** The mint URLs a restore needs beside the words */
	public readonly restore_urls: string[] = getMintRestoreUrls(this.data.mints);
	public readonly form = new FormGroup({
		password: new FormControl<string>('', {nonNullable: true, validators: [Validators.required]}),
	});

	public readonly step = signal<EcashBackupStep>('password');
	/** The recovery words, held only while this panel is open */
	public readonly words = signal<string[]>([]);
	public readonly error = signal<string | null>(null);
	public readonly pending = signal<boolean>(false);
	public readonly written = signal<boolean>(false);
	public readonly typed = signal<string>('');

	public readonly can_submit = computed(() => {
		if (this.pending()) return false;
		if (this.step() === 'password') return this.typed().length > 0;
		if (this.step() === 'words') return this.reshow || this.written();
		return true;
	});

	public readonly submit_label = computed(() => {
		const step = this.step();
		if (step === 'password') return this.pending() ? 'Checking…' : 'Show recovery words';
		if (step === 'words' && this.reshow) return 'Close';
		if (step === 'words') return this.pending() ? 'Saving…' : 'Done';
		return 'Done';
	});

	/** The words step's instructions, focused as the password field goes so the panel keeps focus */
	private readonly words_intro = viewChild<ElementRef<HTMLElement>>('words_intro');

	constructor() {
		this.form.controls.password.valueChanges.pipe(takeUntilDestroyed()).subscribe((password) => {
			this.typed.set(password);
			this.error.set(null);
		});
		effect(() => this.words_intro()?.nativeElement.focus());
	}

	/* *******************************************************
		Actions
	******************************************************** */

	/** Moves the panel on: reveals the words, confirms the backup, or closes once there is nothing left to do */
	public onSubmit(): void {
		if (!this.can_submit()) return;
		if (this.step() === 'password') return this.reveal();
		if (this.step() === 'words' && !this.reshow) return this.confirm();
		this.panelRef.close();
	}

	/** Closes the panel, dropping the words with it */
	public onClose(): void {
		this.panelRef.close();
	}

	/** Checks the password with the server and shows the words it returns */
	private reveal(): void {
		this.pending.set(true);
		this.ecashService
			.revealSeed(this.form.controls.password.value)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (mnemonic) => {
					this.pending.set(false);
					this.form.reset();
					this.words.set(mnemonic.trim().split(/\s+/));
					this.step.set('words');
				},
				error: (errors: OrchardErrors) => {
					this.pending.set(false);
					this.error.set(formatOrchardError(errors.errors[0]).description);
					this.form.controls.password.setErrors({reveal: true});
					this.form.controls.password.markAsTouched();
				},
			});
	}

	/** Records the backup, hands the new status to the host, and clears the words */
	private confirm(): void {
		this.pending.set(true);
		this.ecashService
			.backupSeed()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (seed) => {
					this.pending.set(false);
					this.words.set([]);
					this.panelRef.setResult(seed);
					this.step.set('done');
				},
				error: (errors: OrchardErrors) => {
					this.pending.set(false);
					this.eventService.registerEvent(new EventData({type: 'ERROR', message: errors.errors[0].getFullError()}));
				},
			});
	}
}
