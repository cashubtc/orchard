/** Prints a "Test environments" matrix before Playwright's list reporter
 *  starts streaming, so the top of the scrollback shows what each stack
 *  is for without cross-referencing `helpers/config.ts`. */

/* Core Dependencies */
import fs from 'node:fs';
import path from 'node:path';

/* Vendor Dependencies */
import type {Reporter, FullConfig, Suite} from '@playwright/test/reporter';

/* Native Dependencies */
import {CANARY, CONFIGS, bareConfigName, featuresFor, mintUnitsFor, portOf} from './config';

interface Stack {
	name: string;
	port: string;
	bitcoin: boolean;
	ln: false | 'lnd' | 'cln';
	mint: string;
	db: string;
	units: string;
	features: string[];
	count: number;
	isCanary: boolean;
}

const useColor = !process.env.NO_COLOR;
const ansi = (code: string) => (useColor ? code : '');
const DIM = ansi('\x1b[2m');
const BOLD = ansi('\x1b[1m');
const CYAN = ansi('\x1b[36m');
const YELLOW = ansi('\x1b[33m');
const GREEN = ansi('\x1b[32m');
const MAGENTA = ansi('\x1b[35m');
const RESET = ansi('\x1b[0m');

/** Visible length — strips ANSI so padding math works with colored cells. */
function vlen(s: string): number {
	// eslint-disable-next-line no-control-regex
	return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padRight(s: string, w: number): string {
	return s + ' '.repeat(Math.max(0, w - vlen(s)));
}

function center(s: string, w: number): string {
	const pad = Math.max(0, w - vlen(s));
	const l = Math.floor(pad / 2);
	return ' '.repeat(l) + s + ' '.repeat(pad - l);
}

export default class SummaryReporter implements Reporter {
	onBegin(_config: FullConfig, suite: Suite): void {
		const counts = new Map<string, number>();
		for (const test of suite.allTests()) {
			const projectName = test.parent.project()?.name ?? '';
			const bare = bareConfigName(projectName);
			counts.set(bare, (counts.get(bare) ?? 0) + 1);
		}

		const stacks: Stack[] = Object.values(CONFIGS)
			.map((c) => ({
				name: c.name,
				port: `:${portOf(c)}`,
				bitcoin: c.bitcoin,
				ln: c.ln,
				mint: c.mint,
				db: c.db,
				units: mintUnitsFor(c).join(' '),
				features: featuresFor(c),
				count: counts.get(c.name) ?? 0,
				isCanary: c.name === CANARY,
			}))
			.filter((s) => s.count > 0);

		if (stacks.length === 0) return;

		const labelW = '  Database'.length;
		const colW = stacks.map((s) =>
			Math.max(
				s.port.length,
				s.ln ? s.ln.length : 1,
				s.mint.length,
				s.db.length,
				s.units.length,
				...(s.features.length ? s.features.map((f) => f.length) : [1]),
				String(s.count).length,
				8,
			),
		);
		const featureRows = Math.max(1, ...stacks.map((s) => s.features.length));

		const border = (l: string, sep: string, r: string) =>
			DIM + l + '─'.repeat(labelW + 2) + sep + colW.map((w) => '─'.repeat(w + 2)).join(sep) + r + RESET;

		const row = (label: string, cells: string[]) =>
			DIM +
			'│' +
			RESET +
			' ' +
			padRight(label, labelW) +
			' ' +
			cells.map((c, i) => DIM + '│' + RESET + ' ' + center(c, colW[i]) + ' ').join('') +
			DIM +
			'│' +
			RESET;

		const total = stacks.reduce((a, s) => a + s.count, 0);
		const tableWidth = 1 + (labelW + 2) + stacks.length * 1 + colW.reduce((a, b) => a + b + 2, 0) + stacks.length;

		// ── Matrix box: top border → bottom border ──
		const matrixBox: string[] = [];
		matrixBox.push(border('┌', '┬', '┐'));
		matrixBox.push(
			row(
				'',
				stacks.map((s) => `${BOLD}${s.isCanary ? YELLOW : CYAN}${s.port}${RESET}`),
			),
		);
		matrixBox.push(border('├', '┼', '┤'));
		matrixBox.push(
			row(
				`${BOLD}Bitcoin${RESET}`,
				stacks.map((s) => (s.bitcoin ? 'core' : `${DIM}—${RESET}`)),
			),
		);
		matrixBox.push(
			row(
				`${BOLD}Lightning${RESET}`,
				stacks.map((s) => (s.ln === false ? `${DIM}—${RESET}` : s.ln)),
			),
		);
		matrixBox.push(
			row(
				`${BOLD}Mint${RESET}`,
				stacks.map((s) => s.mint),
			),
		);
		matrixBox.push(
			row(
				`${DIM}  Database${RESET}`,
				stacks.map((s) => `${DIM}${s.db}${RESET}`),
			),
		);
		matrixBox.push(
			row(
				`${DIM}  Units${RESET}`,
				stacks.map((s) => `${DIM}${s.units}${RESET}`),
			),
		);
		for (let i = 0; i < featureRows; i++) {
			matrixBox.push(
				row(
					i === 0 ? `${BOLD}Features${RESET}` : '',
					stacks.map((s) => {
						if (s.features.length === 0) return i === 0 ? `${DIM}—${RESET}` : '';
						const f = s.features[i];
						return f ? `${MAGENTA}${f}${RESET}` : '';
					}),
				),
			);
		}
		matrixBox.push(border('├', '┼', '┤'));
		matrixBox.push(
			row(
				`${BOLD}Tests${RESET}`,
				stacks.map((s) => `${GREEN}${s.count}${RESET}`),
			),
		);
		matrixBox.push(border('└', '┴', '┘'));

		// ── Versions box: pinned image tags the active stacks pull ──
		const versionBox = this.buildVersionBox(stacks);
		const versionWidth = versionBox.length ? vlen(versionBox[0]) : 0;
		const gap = '   ';

		// Zip the two boxes side by side, top-aligned; matrix stays left.
		const combined: string[] = [];
		const rowCount = Math.max(matrixBox.length, versionBox.length);
		for (let i = 0; i < rowCount; i++) {
			if (versionBox[i]) combined.push(padRight(matrixBox[i] ?? '', tableWidth) + gap + versionBox[i]);
			else combined.push(matrixBox[i] ?? '');
		}

		const combinedWidth = tableWidth + (versionWidth ? gap.length + versionWidth : 0);

		const lines: string[] = [''];

		const title = ' ORCHARD E2E TEST MATRIX ';
		const fillers = Math.max(0, combinedWidth - title.length - 6);
		const leftFill = 3;
		const rightFill = fillers - leftFill;
		lines.push(
			`${DIM}${'━'.repeat(leftFill)}${RESET}${BOLD}${CYAN}${title}${RESET}${DIM}${'━'.repeat(Math.max(0, rightFill))}${RESET}`,
		);
		lines.push('');
		lines.push(...combined);

		const canaryStack = stacks.find((s) => s.isCanary);
		const canaryNote = canaryStack ? `  ${DIM}canary:${RESET} ${YELLOW}${canaryStack.port}${RESET}` : '';
		lines.push('');
		lines.push(
			`  ${DIM}Total${RESET} ${BOLD}${GREEN}${total}${RESET} ${DIM}tests across${RESET} ${BOLD}${stacks.length}${RESET} ${DIM}environments${RESET}${canaryNote}`,
		);
		lines.push('');

		process.stdout.write(lines.join('\n') + '\n');
	}

	/** Reads pinned image tags from `e2e/docker/versions.env` — the single
	 *  source of truth for every container tag in the matrix. Returns an empty
	 *  map if the file can't be read (unusual cwd, older checkout) so the
	 *  matrix still renders without the versions column. */
	private loadVersions(): Map<string, string> {
		const versions = new Map<string, string>();
		try {
			const file = path.resolve(process.cwd(), 'e2e', 'docker', 'versions.env');
			for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
				const m = /^([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
				if (m) versions.set(m[1], m[2]);
			}
		} catch {
			/* versions column is best-effort — skip it if the file is unreadable */
		}
		return versions;
	}

	/** Right-hand "IMAGE / VERSION" table listing only the tags the active
	 *  stacks actually pull, derived from `versions.env` and the run's stacks.
	 *  `far` is always lnd (so any LN stack pulls lnd), litd ships tapd (no
	 *  standalone tapd image), and cdk-cli drives every wallet fixture.
	 *  Returns [] when no versions resolve, so the matrix renders alone. */
	private buildVersionBox(stacks: Stack[]): string[] {
		const versions = this.loadVersions();
		if (versions.size === 0) return [];

		const catalog: {label: string; env: string; when: () => boolean}[] = [
			{label: 'bitcoind', env: 'BITCOIND_VERSION', when: () => stacks.some((s) => s.bitcoin)},
			{label: 'lnd', env: 'LND_VERSION', when: () => stacks.some((s) => s.ln !== false)},
			{label: 'cln', env: 'CLN_VERSION', when: () => stacks.some((s) => s.ln === 'cln')},
			{label: 'litd', env: 'LITD_VERSION', when: () => stacks.some((s) => s.features.includes('tapd'))},
			{label: 'nutshell', env: 'NUTSHELL_VERSION', when: () => stacks.some((s) => s.mint === 'nutshell')},
			{label: 'cdk mintd', env: 'CDK_MINTD_VERSION', when: () => stacks.some((s) => s.mint === 'cdk')},
			{label: 'cdk-cli', env: 'CDK_CLI_VERSION', when: () => true},
			{label: 'postgres', env: 'POSTGRES_VERSION', when: () => stacks.some((s) => s.db === 'postgres')},
		];

		const rows = catalog
			.filter((c) => c.when() && versions.has(c.env))
			.map((c) => ({label: c.label, version: versions.get(c.env) as string}));
		if (rows.length === 0) return [];

		const H_IMAGE = 'IMAGE';
		const H_VER = 'VERSION';
		const labelW = Math.max(H_IMAGE.length, ...rows.map((r) => r.label.length));
		const verW = Math.max(H_VER.length, ...rows.map((r) => r.version.length));

		const vborder = (l: string, sep: string, r: string) => DIM + l + '─'.repeat(labelW + 2) + sep + '─'.repeat(verW + 2) + r + RESET;
		const vrow = (label: string, version: string, labelColor: string, versionColor: string) =>
			`${DIM}│${RESET} ${labelColor}${padRight(label, labelW)}${RESET} ${DIM}│${RESET} ${versionColor}${padRight(version, verW)}${RESET} ${DIM}│${RESET}`;

		const out: string[] = [];
		out.push(vborder('┌', '┬', '┐'));
		out.push(vrow(H_IMAGE, H_VER, BOLD, BOLD));
		out.push(vborder('├', '┼', '┤'));
		for (const r of rows) out.push(vrow(r.label, r.version, CYAN, GREEN));
		out.push(vborder('└', '┴', '┘'));
		return out;
	}
}
