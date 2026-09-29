/* Vendor Dependencies */
import type {ErrorCorrection} from 'qr';

/** Borderless square module matrix, indexed [row][col] (true = dark) */
export type QrMatrix = boolean[][];

/** Circular logo slot, in viewBox units */
export type QrLogo = {
	cx: number;
	cy: number;
	r: number;
};

/** Drawable QR geometry shared by the SVG view and the PNG export */
export type QrGeometry = {
	view_size: number;
	modules_path: string;
	eyes_path: string;
	logo: QrLogo | null;
};
/** Content and initial quality for an expanded QR dialog. */
export type QrDialogData = {
	title: string;
	data: string;
	image: string | null;
	ecc: ErrorCorrection | null;
};
