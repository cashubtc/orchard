/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup} from '@angular/forms';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
import {EMPTY, Subject, catchError, filter, map, of, switchMap, take} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {formatOrchardError} from '@client/modules/error/helpers/error.helpers';
import {getMintUri} from '@client/modules/mint/helpers/mint-uri.helpers';
import {isMintAuthOffered} from '@client/modules/mint/helpers/mint-nut.helpers';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMintLookup} from '@client/modules/ecash/classes/ecash-mint-lookup.class';
import {EcashMintAddPanelData} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {WalletMintMatch} from '@shared/generated.types';

/** Where an add-mint lookup stands: a new mint (needing sign-in or not), a new URL joining a wallet mint, or a URL already in the wallet */
type EcashMintAddState = 'idle' | 'loading' | 'error' | 'found' | 'sign_in' | 'joins' | 'exists';

/** The icon beside the mint URL for a lookup state, with its colour class */
type EcashMintAddIcon = {icon: string; color: string};

const MINT_ADD_HINTS: Partial<Record<EcashMintAddState, string>> = {
	found: 'Mint online. Review it before adding.',
	sign_in: 'Mint online, but it requires sign-in.',
	exists: 'Already in your wallet.',
};

const MINT_ADD_ICONS: Partial<Record<EcashMintAddState, EcashMintAddIcon>> = {
	found: {icon: 'check_circle', color: 'orc-status-active-color'},
	joins: {icon: 'check_circle', color: 'orc-status-active-color'},
	sign_in: {icon: 'lock', color: 'orc-status-warning-color'},
	exists: {icon: 'info', color: 'orc-outline-color'},
	error: {icon: 'error', color: 'orc-error-color'},
};

@Component({
	selector: 'orc-ecash-general-mint-add',
	standalone: false,
	templateUrl: './ecash-general-mint-add.component.html',
	styleUrl: './ecash-general-mint-add.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintAddComponent {
	private readonly ecashService = inject(EcashService);
	private readonly eventService = inject(EventService);
	private readonly panelRef = inject(FormPanelRef);
	private readonly destroyRef = inject(DestroyRef);
	public readonly data: EcashMintAddPanelData = inject(FORM_PANEL_DATA);

	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;
	public readonly form = new FormGroup({
		url: new FormControl<string>('', {nonNullable: true}),
	});

	public readonly lookup = signal<EcashMintLookup | null>(null);
	public readonly error = signal<string | null>(null);
	public readonly focused = signal<boolean>(false);
	public readonly expanded = signal<boolean>(false);
	public readonly submitting = signal<boolean>(false);
	public readonly typed = signal<string>('');

	public readonly state = computed<EcashMintAddState>(() => {
		const lookup = this.lookup();
		if (this.error() !== null) return 'error';
		if (!lookup) return this.looked_up() === null ? 'idle' : 'loading';
		if (lookup.match === WalletMintMatch.Url) return 'exists';
		if (lookup.match === WalletMintMatch.Pubkey) return 'joins';
		return lookup.info && isMintAuthOffered(lookup.info.nuts) ? 'sign_in' : 'found';
	});

	/** The wallet mint the looked-up URL already is, or joins */
	public readonly wallet_mint = computed(() => this.data.mints().find((mint) => mint.id === this.lookup()?.mint_id) ?? null);

	/** What the lookup found, under the field */
	public readonly hint = computed(() => {
		const state = this.state();
		if (state === 'loading') return `Checking ${getMintUri(this.typed()).label}…`;
		if (state === 'joins') return `Mint online. This is another address for ${this.wallet_mint()?.display_name ?? 'a mint you have'}.`;
		return MINT_ADD_HINTS[state] ?? null;
	});

	public readonly status_icon = computed(() => MINT_ADD_ICONS[this.state()] ?? null);

	/** Whether the typed URL can be looked up: a mint address not yet asked about, or one whose lookup failed */
	public readonly can_lookup = computed(() => {
		const url = this.typed().trim();
		return this.toMintUrl(url) !== null && (url !== this.looked_up() || this.error() !== null);
	});

	public readonly can_add = computed(() => ['found', 'sign_in', 'joins'].includes(this.state()) && !this.submitting());

	private readonly looked_up = signal<string | null>(null);

	/** URLs to look up; null cancels the lookup in flight */
	private readonly lookups = new Subject<string | null>();

	constructor() {
		this.form.controls.url.valueChanges.pipe(takeUntilDestroyed()).subscribe((url) => this.onUrl(url));
		this.lookups
			.pipe(
				switchMap((url) =>
					url === null
						? EMPTY
						: this.ecashService.lookupMint(url).pipe(
								map((lookup) => ({lookup, error: null})),
								catchError((errors: OrchardErrors) =>
									of({lookup: null, error: formatOrchardError(errors.errors[0]).description}),
								),
							),
				),
				takeUntilDestroyed(),
			)
			.subscribe(({lookup, error}) => {
				this.lookup.set(lookup);
				this.error.set(error);
				if (error === null) return;
				this.form.controls.url.setErrors({lookup: true});
				this.form.controls.url.markAsTouched();
			});
	}

	/* *******************************************************
		Lookup
	******************************************************** */

	/** Editing the URL clears what was found for the last one, cancelling a lookup still running */
	private onUrl(url: string): void {
		this.typed.set(url);
		if (url.trim() === this.looked_up()) return;
		this.lookups.next(null);
		this.looked_up.set(null);
		this.lookup.set(null);
		this.error.set(null);
		this.expanded.set(false);
	}

	/** Asks the server about the typed URL */
	public onLookup(): void {
		if (!this.can_lookup() || this.submitting()) return;
		const url = this.typed().trim();
		this.looked_up.set(url);
		this.lookup.set(null);
		this.error.set(null);
		this.lookups.next(url);
	}

	/** Leaving the field looks up a URL that changed since it was last asked about, once its host looks complete: a domain or a port */
	public onBlur(): void {
		this.focused.set(false);
		const url = this.typed().trim();
		const parsed = this.toMintUrl(url);
		if (url !== this.looked_up() && parsed && (parsed.hostname.includes('.') || parsed.port)) this.onLookup();
	}

	/** Clears the field back to where it started */
	public onCancel(event: Event): void {
		event.preventDefault();
		this.form.controls.url.reset();
	}

	/** The text as a mint address: an http(s) URL, or a bare host the server looks up over https; null when it isn't one */
	private toMintUrl(url: string): URL | null {
		try {
			const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`);
			return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
		} catch {
			return null;
		}
	}

	/* *******************************************************
		Actions
	******************************************************** */

	/** Adds the looked-up mint by the URL it was looked up with, so the server reuses that lookup; closes once its success is on screen, and a refusal shows the server's own message */
	public onSubmit(): void {
		const url = this.looked_up();
		if (!url || !this.can_add()) return;
		this.submitting.set(true);
		this.form.controls.url.disable({emitEvent: false});
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		this.ecashService
			.addMint(url)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (mint) => {
					const success = new EventData({type: 'SUCCESS', message: 'Mint added'});
					this.panelRef.setResult(mint);
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
				error: (errors: OrchardErrors) => {
					this.submitting.set(false);
					this.form.controls.url.enable({emitEvent: false});
					this.eventService.registerEvent(new EventData({type: 'ERROR', message: errors.errors[0].getFullError()}));
				},
			});
	}

	/** Closes the panel without adding */
	public onClose(): void {
		this.panelRef.close();
	}
}
