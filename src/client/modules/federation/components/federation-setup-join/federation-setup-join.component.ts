/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';

/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';

/* Native Dependencies */
import {decodeSetupInvitation, setupUrlHost} from '@client/modules/federation/helpers/federation-setup.helpers';
import type {FederationSetupInvitationPreview} from '@client/modules/federation/types/federation-setup.types';

/* Shared Dependencies */
import type {FederationSetupJoinInput} from '@shared/generated.types';

interface QrDetector {
	detect(image: ImageBitmap): Promise<Array<{rawValue: string}>>;
}
type QrDetectorConstructor = new (options: {formats: string[]}) => QrDetector;

@Component({
	selector: 'orc-federation-setup-join',
	imports: [
		FormsModule,
		MatButtonModule,
		MatCardModule,
		MatCheckboxModule,
		MatDividerModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		OrcFormModule,
	],
	templateUrl: './federation-setup-join.component.html',
	styleUrls: ['../federation-setup/federation-setup-shared.scss', './federation-setup-join.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupJoinComponent {
	public readonly busy = input(false);
	public readonly join = output<FederationSetupJoinInput>();
	public readonly cancel = output<void>();
	public readonly scanner = (globalThis as typeof globalThis & {BarcodeDetector?: QrDetectorConstructor}).BarcodeDetector;

	public readonly invitation = signal('');
	public readonly public_url = signal('');
	public readonly federation_url = signal('');
	public readonly allow_local = signal(false);
	public readonly file_error = signal<string | null>(null);
	public readonly reading = signal(false);
	public readonly help = signal<string | null>(null);

	public readonly valid = computed(() => !!this.invitation().trim());
	/** What the invitation says about itself; the mint verifies it when this member joins. */
	public readonly preview = computed<FederationSetupInvitationPreview | null>(() => decodeSetupInvitation(this.invitation()));
	public readonly coordinator = computed<string | null>(() => {
		const preview = this.preview();
		return preview ? setupUrlHost(preview.coordinator_url) : null;
	});
	public readonly expires = computed<string | null>(() => {
		const preview = this.preview();
		return preview ? DateTime.fromSeconds(preview.expires_at_unix).toRelative() : null;
	});

	/* *******************************************************
        Help
    ******************************************************** */

	/** Open one field's help, or close it when it's already open. */
	public toggleHelp(key: string): void {
		this.help.update((current) => (current === key ? null : key));
	}

	/* *******************************************************
        Invitation
    ******************************************************** */

	/** Read an invitation text file, or decode a QR photo locally in supported browsers. */
	public async openFile(event: Event, qr = false): Promise<void> {
		const input_element = event.target as HTMLInputElement;
		const file = input_element.files?.[0];
		if (!file) return;
		this.file_error.set(null);
		this.reading.set(true);
		try {
			if (file.size > (qr ? 10000000 : 1000000)) throw new Error('The invitation file is too large.');
			if (!qr) {
				this.invitation.set((await file.text()).trim());
				return;
			}
			const bitmap = await createImageBitmap(file);
			try {
				const codes = await new this.scanner!({formats: ['qr_code']}).detect(bitmap);
				if (codes.length !== 1) throw new Error('Choose a photo containing exactly one invitation QR code.');
				this.invitation.set(codes[0].rawValue.trim());
			} finally {
				bitmap.close();
			}
		} catch (error) {
			this.file_error.set(error instanceof Error ? error.message : 'Could not read the invitation. Paste it or open its text file.');
		} finally {
			this.reading.set(false);
			input_element.value = '';
		}
	}

	/* *******************************************************
        Actions Up
    ******************************************************** */

	/** Emit the invitation only to the parent handling the authenticated request; blank URLs use the mint's defaults. */
	public submit(): void {
		if (!this.valid() || this.busy() || this.reading()) return;
		this.join.emit({
			invitation: this.invitation().trim(),
			allow_insecure_localhost: this.allow_local(),
			public_mint_url: this.public_url().trim() || undefined,
			federation_api_url: this.federation_url().trim() || undefined,
		});
	}
}
