/* Vendor Dependencies */
import decodeQR from 'qr/decode.js';

/* Native Dependencies */
import {QrGeometry, QrMatrix} from '@client/modules/graphic/types/graphic-qr.types';

/* Local Dependencies */
import {QR_ECC_LEVELS, QR_ECC_LOGO_FLOOR, buildQrGeometry, encodeQrMatrix, resolveQrEcc} from './graphic-qr.helpers';

const BOLT11 =
	'LNBC2500U1PVJLUEZSP5ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYGSPP5QQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQYPQDQ5XYSXXATSYP3K7ENXV4JSXQZPU9QRSGQUK';

/** Counts closed subpaths in a path string */
function countShapes(path: string): number {
	return (path.match(/M/g) ?? []).length;
}

/** Rasterizes geometry dark-on-light and decodes it back to text */
function scan(geometry: QrGeometry, logo_color: string | null = null): string {
	const scale = 8;
	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(geometry.view_size * scale);
	canvas.height = canvas.width;
	const context = canvas.getContext('2d')!;
	context.scale(scale, scale);
	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, geometry.view_size, geometry.view_size);
	context.fillStyle = '#000000';
	context.fill(new Path2D(geometry.modules_path), 'evenodd');
	context.fill(new Path2D(geometry.eyes_path));
	if (geometry.logo && logo_color) {
		context.fillStyle = logo_color;
		context.beginPath();
		context.arc(geometry.logo.cx, geometry.logo.cy, geometry.logo.r, 0, Math.PI * 2);
		context.fill();
	}
	return decodeQR(context.getImageData(0, 0, canvas.width, canvas.height));
}

describe('resolveQrEcc', () => {
	it('defaults to quartile without a logo and high with one', () => {
		expect(resolveQrEcc(null, false)).toBe('quartile');
		expect(resolveQrEcc(null, true)).toBe('high');
	});

	it('honors any requested level without a logo', () => {
		for (const ecc of QR_ECC_LEVELS) expect(resolveQrEcc(ecc, false)).toBe(ecc);
	});

	it('raises levels below the floor when a logo is shown', () => {
		expect(resolveQrEcc('low', true)).toBe(QR_ECC_LOGO_FLOOR);
		expect(resolveQrEcc('medium', true)).toBe(QR_ECC_LOGO_FLOOR);
		expect(resolveQrEcc('high', true)).toBe('high');
	});
});

describe('encodeQrMatrix', () => {
	it('returns null for an empty value', () => {
		expect(encodeQrMatrix('', 'quartile')).toBeNull();
	});

	it('returns a borderless square matrix with finder corners at the edges', () => {
		const matrix = encodeQrMatrix('hello', 'quartile')!;
		expect(matrix.length).toBe(21);
		expect(matrix.every((row) => row.length === 21)).toBeTrue();
		expect(matrix[0].slice(0, 7).every(Boolean)).toBeTrue();
		expect(matrix[0][20]).toBeTrue();
		expect(matrix[20][0]).toBeTrue();
	});

	it('uses a denser symbol at higher error correction', () => {
		expect(encodeQrMatrix(BOLT11, 'high')!.length).toBeGreaterThan(encodeQrMatrix(BOLT11, 'low')!.length);
	});

	it('returns null instead of throwing when the value exceeds capacity', () => {
		spyOn(console, 'error');
		expect(encodeQrMatrix('x'.repeat(5000), 'low')).toBeNull();
	});
});

describe('buildQrGeometry', () => {
	const solid = (n: number): QrMatrix => Array.from({length: n}, () => Array<boolean>(n).fill(true));

	it('draws one dot per dark module outside the finders, plus two ring subpaths and one eye per finder', () => {
		const geometry = buildQrGeometry(solid(21), false);
		expect(countShapes(geometry.modules_path)).toBe(21 * 21 - 3 * 49 + 6);
		expect(countShapes(geometry.eyes_path)).toBe(3);
		expect(geometry.logo).toBeNull();
	});

	it('keeps the matrix at the same fraction of the view box for every version', () => {
		const small = buildQrGeometry(solid(21), false);
		const large = buildQrGeometry(solid(77), false);
		expect(21 / small.view_size).toBeCloseTo(77 / large.view_size, 3);
	});

	it('centers the logo and clears the dots beneath it', () => {
		const plain = buildQrGeometry(solid(41), false);
		const with_logo = buildQrGeometry(solid(41), true);
		expect(with_logo.logo!.cx).toBeCloseTo(with_logo.view_size / 2, 3);
		expect(with_logo.logo!.cy).toBeCloseTo(with_logo.view_size / 2, 3);
		expect(countShapes(with_logo.modules_path)).toBeLessThan(countShapes(plain.modules_path));
	});

	for (const ecc of QR_ECC_LEVELS) {
		it(`produces a scannable symbol at ${ecc} error correction`, () => {
			expect(scan(buildQrGeometry(encodeQrMatrix(BOLT11, ecc)!, false))).toBe(BOLT11);
		});
	}

	it('stays scannable with a logo at the lowest allowed error correction', () => {
		const url = 'https://mint.example.com/auth/signup/2b7f0c9e-1d4a-4f7e-9a51-0c3e2d6b8f14';
		expect(scan(buildQrGeometry(encodeQrMatrix(url, QR_ECC_LOGO_FLOOR)!, true), '#7a3cff')).toBe(url);
	});
});
