/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	Injector,
	afterNextRender,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Clipboard} from '@angular/cdk/clipboard';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
import {MatButton} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {DateTime} from 'luxon';
import {filter, take, timer} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {getRequestErrorMessage} from '@client/modules/error/helpers/error.helpers';
import {GraphicQrDialogComponent} from '@client/modules/graphic/components/graphic-qr-dialog/graphic-qr-dialog.component';
import {QrDialogData} from '@client/modules/graphic/types/graphic-qr.types';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMintViewPanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
import {
	buildUnitChips,
	getMintCheckedText,
	getMintSubtitle,
} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

const COPIED_RESET_MS = 2000;

@Component({
	selector: 'orc-ecash-general-mint-view',
	standalone: false,
	templateUrl: './ecash-general-mint-view.component.html',
	styleUrl: './ecash-general-mint-view.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintViewComponent {
	private readonly ecashService = inject(EcashService);
	private readonly eventService = inject(EventService);
	private readonly clipboard = inject(Clipboard);
	private readonly dialog = inject(MatDialog);
	private readonly panelRef = inject(FormPanelRef);
	private readonly injector = inject(Injector);
	private readonly destroyRef = inject(DestroyRef);
	private readonly data: EcashMintViewPanelData = inject(FORM_PANEL_DATA);

	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;

	public readonly expanded = signal<boolean>(false);
	public readonly copied = signal<boolean>(false);
	public readonly refreshing = signal<boolean>(false);
	public readonly confirming = signal<boolean>(false);
	public readonly removing = signal<boolean>(false);

	public readonly mint = this.data.mint;
	public readonly status = this.data.status;
	/** The URL others reach the mint at; null without a public one */
	public readonly url = computed(() => this.mint().urls[0] ?? null);
	public readonly subtitle = computed(() => getMintSubtitle(this.url(), this.mint().info?.version ?? null));
	/** What the wallet holds at this mint, by unit */
	public readonly held = computed(() => buildUnitChips([], this.data.balances()).filter((chip) => chip.amount > 0));

	public readonly checked_text = computed(() => {
		const checked_at = this.data.checked_at();
		return checked_at === null ? null : getMintCheckedText(checked_at, DateTime.now().toUnixInteger());
	});

	/** Why the mint can't be removed, as far as the page knows; the server has the final say */
	public readonly remove_note = computed(() => {
		if (this.mint().is_orchard) return 'The Orchard mint stays in every wallet.';
		if (this.held().length > 0) return 'Holds ecash. Spend or move it first.';
		return null;
	});

	private readonly remove_button = viewChild<MatButton>('remove_button');
	private readonly remove_cancel = viewChild<MatButton>('remove_cancel');

	/* *******************************************************
		Actions
	******************************************************** */

	/** Copies the mint's URL, showing a check for a moment */
	public onCopyUrl(): void {
		const url = this.url();
		if (!url || !this.clipboard.copy(url)) return;
		this.copied.set(true);
		timer(COPIED_RESET_MS)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.copied.set(false));
	}

	/** Shows the mint's URL as a QR code, for another wallet to scan */
	public onQr(): void {
		const url = this.url();
		if (!url) return;
		this.dialog.open<GraphicQrDialogComponent, QrDialogData>(GraphicQrDialogComponent, {
			width: '560px',
			maxWidth: 'calc(100vw - 32px)',
			maxHeight: 'calc(100dvh - 32px)',
			autoFocus: 'dialog',
			data: {title: this.mint().display_name, data: url, image: null, ecc: null},
		});
	}

	/** Checks the mint now and settles the wallet's unfinished operations with it; the page reloads what that changed */
	public onRefresh(): void {
		if (this.refreshing()) return;
		this.refreshing.set(true);
		this.ecashService
			.refreshMint(this.mint().id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => {
					this.refreshing.set(false);
					this.data.refreshed(status);
				},
				error: (error: unknown) => {
					this.refreshing.set(false);
					this.showError(error);
				},
			});
	}

	/** Removes the mint; closes once its success is on screen, and a refusal shows the server's own message */
	public onRemove(): void {
		if (this.removing()) return;
		this.removing.set(true);
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.ecashService
			.removeMint(this.mint().id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					const success = new EventData({type: 'SUCCESS', message: 'Mint removed'});
					this.panelRef.setResult(true);
					this.eventService
						.getActiveEvent()
						.pipe(
							filter((event) => event === success),
							take(1),
							takeUntilDestroyed(this.destroyRef),
						)
						.subscribe(() => this.panelRef.close());
					this.eventService.registerEvent(success);
				},
				error: (error: unknown) => {
					this.removing.set(false);
					this.onCancelRemove();
					this.showError(error);
				},
			});
	}

	/** Asks before removing, focusing Cancel as the safe choice */
	public onConfirmRemove(): void {
		this.confirming.set(true);
		afterNextRender(() => this.remove_cancel()?.focus(), {injector: this.injector});
	}

	/** Backs out of removing, returning focus to the button that asked */
	public onCancelRemove(): void {
		this.confirming.set(false);
		afterNextRender(() => this.remove_button()?.focus(), {injector: this.injector});
	}

	/** Escape backs out of the confirm alone, keeping the panel open */
	public onConfirmEscape(event: Event): void {
		event.stopPropagation();
		if (!this.removing()) this.onCancelRemove();
	}

	/** Closes the panel */
	public onClose(): void {
		this.panelRef.close();
	}

	/** Shows a failed request, unless the session redirect is handling it */
	private showError(error: unknown): void {
		const message = getRequestErrorMessage(error);
		if (message) this.eventService.registerEvent(new EventData({type: 'ERROR', message}));
	}
}
