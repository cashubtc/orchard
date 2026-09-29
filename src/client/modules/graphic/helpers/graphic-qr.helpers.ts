/* Vendor Dependencies */
import encodeQR from 'qr';
import type {ErrorCorrection} from 'qr';

/* Native Dependencies */
import {QrGeometry, QrLogo, QrMatrix} from '@client/modules/graphic/types/graphic-qr.types';

/** Error correction levels from least to most redundant (sparsest to densest symbol) */
export const QR_ECC_LEVELS: ErrorCorrection[] = ['low', 'medium', 'quartile', 'high'];
/** Lowest level that reliably rebuilds the modules hidden by a logo */
export const QR_ECC_LOGO_FLOOR: ErrorCorrection = 'quartile';

/** Fraction of the viewBox covered by the matrix; the rest is quiet zone, so every version renders at the same scale */
const DRAWN_FRACTION = 0.875;
/** Data module dot: edge length and corner radius, in modules */
const DOT_SIZE = 0.85;
const DOT_RADIUS = 0.32;
/** Logo diameter as a fraction of the matrix edge (~7% of the area, well inside EC recovery) */
const LOGO_FRACTION = 0.3;
/** Clearance between the logo edge and the nearest dot, in modules */
const LOGO_GAP = 0.55;
/** Finder pattern edge, in modules */
const FINDER_SIZE = 7;

/** Picks the error correction level: the requested one (default high with a logo, quartile without), never below the logo floor */
export function resolveQrEcc(requested: ErrorCorrection | null, with_logo: boolean): ErrorCorrection {
	const level = requested ?? (with_logo ? 'high' : 'quartile');
	if (!with_logo) return level;
	return QR_ECC_LEVELS.indexOf(level) < QR_ECC_LEVELS.indexOf(QR_ECC_LOGO_FLOOR) ? QR_ECC_LOGO_FLOOR : level;
}

/** Encodes a value into a borderless module matrix. Returns null if unencodable. */
export function encodeQrMatrix(value: string, ecc: ErrorCorrection): QrMatrix | null {
	if (!value) return null;
	try {
		// border 0 is rejected, so request the minimum ring and slice it off
		const bordered = encodeQR(value, 'raw', {ecc, border: 1});
		return bordered.slice(1, -1).map((row) => row.slice(1, -1));
	} catch (error) {
		console.error(`QR encode failed for a ${value.length} character value`, error);
		return null;
	}
}

/** Converts a module matrix into rounded-dot paths with framed finder patterns and an optional centered logo slot */
export function buildQrGeometry(matrix: QrMatrix, with_logo: boolean): QrGeometry {
	const n = matrix.length;
	const pad = (n * (1 - DRAWN_FRACTION)) / (2 * DRAWN_FRACTION);
	const view_size = n + pad * 2;
	const logo: QrLogo | null = with_logo ? {cx: pad + n / 2, cy: pad + n / 2, r: (n * LOGO_FRACTION) / 2} : null;
	const finders: [number, number][] = [
		[0, 0],
		[0, n - FINDER_SIZE],
		[n - FINDER_SIZE, 0],
	];

	const dot_inset = (1 - DOT_SIZE) / 2;
	const dots: string[] = [];
	for (let row = 0; row < n; row++) {
		for (let col = 0; col < n; col++) {
			if (!matrix[row][col]) continue;
			if (isInFinder(row, col, n)) continue;
			if (logo && isUnderLogo(pad + col + 0.5, pad + row + 0.5, logo)) continue;
			dots.push(roundedSquare(pad + col + dot_inset, pad + row + dot_inset, DOT_SIZE, DOT_RADIUS));
		}
	}

	const rings = finders.map(([row, col]) => {
		const x = pad + col;
		const y = pad + row;
		return roundedSquare(x, y, 7, 2.3) + roundedSquare(x + 1, y + 1, 5, 1.3);
	});
	const eyes = finders.map(([row, col]) => roundedSquare(pad + col + 2, pad + row + 2, 3, 0.9));

	return {
		view_size: round(view_size),
		modules_path: rings.join('') + dots.join(''),
		eyes_path: eyes.join(''),
		logo: logo ? {cx: round(logo.cx), cy: round(logo.cy), r: round(logo.r)} : null,
	};
}

/** True when the module sits inside one of the three 7x7 finder patterns */
function isInFinder(row: number, col: number, n: number): boolean {
	const top = row < FINDER_SIZE;
	const left = col < FINDER_SIZE;
	return (top && left) || (top && col >= n - FINDER_SIZE) || (left && row >= n - FINDER_SIZE);
}

/** True when a dot centered at (x, y) would touch the logo or its clearance ring */
function isUnderLogo(x: number, y: number, logo: QrLogo): boolean {
	const reach = logo.r + LOGO_GAP;
	return (x - logo.cx) ** 2 + (y - logo.cy) ** 2 < reach ** 2;
}

/** Path for a closed rounded square; callers fill with evenodd so a nested square cuts a hole */
function roundedSquare(x: number, y: number, size: number, radius: number): string {
	const r = round(radius);
	const edge = round(size - radius * 2);
	const corner = (dx: number, dy: number): string => `a${r} ${r} 0 0 1 ${round(dx)} ${round(dy)}`;
	return (
		`M${round(x + radius)} ${round(y)}h${edge}${corner(r, r)}v${edge}${corner(-r, r)}` +
		`h${-edge}${corner(-r, -r)}v${-edge}${corner(r, -r)}z`
	);
}

/** Trims float noise so path strings stay compact */
function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
