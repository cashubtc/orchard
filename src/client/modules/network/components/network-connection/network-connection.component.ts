/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, computed, signal, viewChild} from '@angular/core';
/* Vendor Dependencies */
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import type {ErrorCorrection} from 'qr';
/* Application Dependencies */
import {GraphicQrComponent} from '@client/modules/graphic/components/graphic-qr/graphic-qr.component';
import {QR_ECC_LEVELS, QR_ECC_LOGO_FLOOR} from '@client/modules/graphic/helpers/graphic-qr.helpers';
/* Native Dependencies */
import {NetworkConnection} from '@client/modules/network/types/network-connection.type';

@Component({
	selector: 'orc-network-connection',
	standalone: false,
	templateUrl: './network-connection.component.html',
	styleUrl: './network-connection.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkConnectionComponent {
	public data = inject<NetworkConnection>(MAT_DIALOG_DATA);

	public readonly ecc_max = QR_ECC_LEVELS.length - 1;

	public readonly show_image = signal<boolean>(true);
	public readonly ecc_index = signal<number>(this.ecc_max);

	public readonly qr_image = computed(() => (this.show_image() ? this.data.image : null));
	public readonly ecc = computed((): ErrorCorrection => QR_ECC_LEVELS[this.ecc_index()]);

	private readonly logo_floor_index = QR_ECC_LEVELS.indexOf(QR_ECC_LOGO_FLOOR);

	public size = computed(() => {
		return this.data.device_type === 'mobile' ? 295 : 395;
	});

	public status_message = computed(() => {
		switch (this.data.status) {
			case 'active':
				return 'Publicly reachable';
			case 'inactive':
				return 'Not reachable';
			case 'warning':
				return 'API offline';
			default:
				return 'Unknown status';
		}
	});

	private readonly qr = viewChild(GraphicQrComponent);

	/* *******************************************************
		QR Options
	******************************************************** */

	/** Sets the error correction level; levels too sparse to rebuild a logo turn the logo off */
	public onEccChange(index: number): void {
		this.ecc_index.set(index);
		if (index < this.logo_floor_index) this.show_image.set(false);
	}

	/** Toggles the logo; showing it raises error correction to the logo floor */
	public onImageChange(checked: boolean): void {
		this.show_image.set(checked);
		if (checked && this.ecc_index() < this.logo_floor_index) this.ecc_index.set(this.logo_floor_index);
	}

	/* *******************************************************
		Export
	******************************************************** */

	/** Saves the QR as a PNG named after the connection */
	public download(): void {
		this.qr()?.download(`${this.data.name}_qr`);
	}
}
