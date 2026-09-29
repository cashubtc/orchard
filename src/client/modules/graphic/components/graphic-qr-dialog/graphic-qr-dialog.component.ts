/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, signal, viewChild} from '@angular/core';

/* Vendor Dependencies */
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import type {ErrorCorrection} from 'qr';

/* Native Dependencies */
import {GraphicQrComponent} from '@client/modules/graphic/components/graphic-qr/graphic-qr.component';
import {QR_ECC_LEVELS, QR_ECC_LOGO_FLOOR, resolveQrEcc} from '@client/modules/graphic/helpers/graphic-qr.helpers';
import {QrDialogData} from '@client/modules/graphic/types/graphic-qr.types';

@Component({
	selector: 'orc-graphic-qr-dialog',
	standalone: false,
	templateUrl: './graphic-qr-dialog.component.html',
	styleUrl: './graphic-qr-dialog.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphicQrDialogComponent {
	private readonly dialog_data = inject<QrDialogData>(MAT_DIALOG_DATA);

	public readonly data = this.dialog_data;
	public readonly ecc_min = this.data.image ? QR_ECC_LEVELS.indexOf(QR_ECC_LOGO_FLOOR) : 0;
	public readonly ecc_max = QR_ECC_LEVELS.length - 1;

	public readonly ecc_index = signal<number>(QR_ECC_LEVELS.indexOf(resolveQrEcc(this.data.ecc, !!this.data.image)));

	public readonly ecc = computed((): ErrorCorrection => resolveQrEcc(QR_ECC_LEVELS[this.ecc_index()], !!this.data.image));

	private readonly qr = viewChild(GraphicQrComponent);

	/* *******************************************************
		Download
	******************************************************** */

	/** Saves the enlarged QR with the selected quality and a descriptive filename. */
	public download(): void {
		const file_name =
			this.data.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '_')
				.replace(/^_|_$/g, '') || 'qr';
		this.qr()?.download(`${file_name}_qr`);
	}
}
