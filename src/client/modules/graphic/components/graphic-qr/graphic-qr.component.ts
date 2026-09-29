/* Core Dependencies */
import {ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, viewChild} from '@angular/core';

/* Vendor Dependencies */
import type {ErrorCorrection} from 'qr';

/* Native Dependencies */
import {buildQrGeometry, encodeQrMatrix, resolveQrEcc} from '@client/modules/graphic/helpers/graphic-qr.helpers';
import {QrGeometry, QrLogo} from '@client/modules/graphic/types/graphic-qr.types';

/** Edge length of the downloaded PNG, in pixels */
const DOWNLOAD_SIZE = 1024;

@Component({
	selector: 'orc-graphic-qr',
	standalone: false,
	templateUrl: './graphic-qr.component.html',
	styleUrl: './graphic-qr.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[style.width.px]': 'size()',
	},
})
export class GraphicQrComponent {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	public readonly data = input.required<string>();
	public readonly size = input<number>(195);
	public readonly image = input<string | null>(null);
	/** Error correction level; null picks a default for the logo state. Raised to the logo floor when a logo is shown. */
	public readonly ecc = input<ErrorCorrection | null>(null);

	public readonly geometry = computed((): QrGeometry | null => {
		const with_logo = !!this.image();
		const matrix = encodeQrMatrix(this.data(), resolveQrEcc(this.ecc(), with_logo));
		return matrix ? buildQrGeometry(matrix, with_logo) : null;
	});
	public readonly view_box = computed(() => {
		const view_size = this.geometry()?.view_size ?? 0;
		return `0 0 ${view_size} ${view_size}`;
	});
	/** Logo box as percentages of the host, so the overlay tracks the SVG at any size */
	public readonly logo_box = computed(() => {
		const geometry = this.geometry();
		if (!geometry?.logo) return null;
		const {cx, cy, r} = geometry.logo;
		const to_pct = (value: number): number => (value / geometry.view_size) * 100;
		return {left: to_pct(cx - r), top: to_pct(cy - r), size: to_pct(r * 2)};
	});

	private readonly modules_path = viewChild<ElementRef<SVGPathElement>>('modules_path');
	private readonly eyes_path = viewChild<ElementRef<SVGPathElement>>('eyes_path');

	/* *******************************************************
		Export
	******************************************************** */

	/** Rasterizes the QR with its resolved theme colors and saves it as `<file_name>.png` */
	public async download(file_name: string): Promise<void> {
		const blob = await this.toPngBlob();
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${file_name}.png`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	/** Draws the same geometry onto a canvas; colors are read from the rendered SVG so the PNG matches what is on screen */
	private async toPngBlob(): Promise<Blob | null> {
		const geometry = this.geometry();
		const modules_el = this.modules_path()?.nativeElement;
		const eyes_el = this.eyes_path()?.nativeElement;
		if (!geometry || !modules_el || !eyes_el) return null;

		const canvas = document.createElement('canvas');
		canvas.width = DOWNLOAD_SIZE;
		canvas.height = DOWNLOAD_SIZE;
		const context = canvas.getContext('2d');
		if (!context) return null;

		context.scale(DOWNLOAD_SIZE / geometry.view_size, DOWNLOAD_SIZE / geometry.view_size);
		context.fillStyle = getComputedStyle(this.host.nativeElement).backgroundColor;
		context.fillRect(0, 0, geometry.view_size, geometry.view_size);
		context.fillStyle = getComputedStyle(modules_el).fill;
		context.fill(new Path2D(geometry.modules_path), 'evenodd');
		context.fillStyle = getComputedStyle(eyes_el).fill;
		context.fill(new Path2D(geometry.eyes_path));

		const image_src = this.image();
		if (geometry.logo && image_src) await this.drawLogo(context, geometry.logo, image_src);

		return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
	}

	/** Draws the logo clipped to its circle with cover fit; an image that fails to load leaves the slot empty */
	private async drawLogo(context: CanvasRenderingContext2D, logo: QrLogo, src: string): Promise<void> {
		const image = await loadImage(src).catch(() => null);
		if (!image?.naturalWidth || !image.naturalHeight) return;
		const scale = Math.max((logo.r * 2) / image.naturalWidth, (logo.r * 2) / image.naturalHeight);
		const width = image.naturalWidth * scale;
		const height = image.naturalHeight * scale;
		context.save();
		context.beginPath();
		context.arc(logo.cx, logo.cy, logo.r, 0, Math.PI * 2);
		context.clip();
		context.drawImage(image, logo.cx - width / 2, logo.cy - height / 2, width, height);
		context.restore();
	}
}

/** Loads an image for canvas use without tainting it */
function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}
