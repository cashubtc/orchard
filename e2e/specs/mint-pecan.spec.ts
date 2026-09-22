/** Pecan fixtures exercise Orchard with a real custom-method, custom-unit mint. */
import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {dockerExec} from '@e2e/helpers/backend/docker-cli';
import {gql} from '@e2e/helpers/ui/gql';
import type {ConfigInfo} from '@e2e/types/config';

type QuoteFixture = {quote: string; amount: number; request: string};
type PecanFixtures = {deposits: QuoteFixture[]; withdrawals: QuoteFixture[]; unpaid: QuoteFixture; voided: QuoteFixture};
type OrchardQuote = {id: string; amount: number; unit: string; payment_method: string; request: string; state: string};

/** Read only public quote identifiers, never wallet proofs or signing keys. */
function fixturesFor(config: ConfigInfo): PecanFixtures {
	return JSON.parse(dockerExec(['exec', `${config.name}-wallet`, 'cat', '/wallet/fixtures.json'])) as PecanFixtures;
}

/** Open a quote table through the same selector used by an operator. */
async function openQuotes(page: Page, kind: 'mint' | 'melt'): Promise<void> {
	await page.goto('/mint/database', {waitUntil: 'networkidle'});
	const select = page.locator('orc-mint-subsection-database-control mat-select');
	await select.click();
	await page
		.locator('mat-option .option-main')
		.filter({hasText: kind === 'mint' ? /^Mints$/ : /^Melts$/})
		.click();
	await expect(page.locator('orc-mint-subsection-database-table tr.entity-row').first()).toBeVisible();
}

test.describe('Pecan — ora/branch compatibility', {tag: '@pecan'}, () => {
	test.afterEach(async ({page}) => {
		await page.evaluate(() => localStorage.removeItem('v1.mint.database.settings'));
	});

	test('Orchard reports paid, issued, unpaid, and voided fixture quotes in native ora units', async ({page}, test_info) => {
		const config = getConfig(test_info.project.name);
		const fixtures = fixturesFor(config);
		await page.goto('/mint');
		const data = await gql(
			page,
			`query PecanQuotes {
			mint_mint_quotes(units: ["ora"], page: 1, page_size: 100) {id amount unit payment_method request state}
			mint_melt_quotes(units: ["ora"], page: 1, page_size: 100) {id amount unit payment_method request state}
		}`,
		);
		const mints = data.mint_mint_quotes as OrchardQuote[];
		const melts = data.mint_melt_quotes as OrchardQuote[];
		for (const [fixture, quotes, state] of [
			...fixtures.deposits.map((fixture) => [fixture, mints, 'ISSUED'] as const),
			...fixtures.withdrawals.map((fixture) => [fixture, melts, 'PAID'] as const),
			[fixtures.unpaid, mints, 'UNPAID'] as const,
			[fixtures.voided, melts, 'UNPAID'] as const,
		]) {
			const quote = quotes.find((candidate) => candidate.id === fixture.quote);
			expect(quote).toMatchObject({unit: 'ora', payment_method: 'branch', request: fixture.request, state});
			expect(Number(quote!.amount)).toBe(fixture.amount);
		}
	});

	for (const kind of ['mint', 'melt'] as const) {
		test(`${kind} detail displays and copies the original Pecan request`, async ({page, context}, test_info) => {
			const config = getConfig(test_info.project.name);
			const fixtures = fixturesFor(config);
			const fixture = kind === 'mint' ? fixtures.unpaid : fixtures.withdrawals[0];
			const db_row = mint.quoteById(config, kind, fixture.quote);
			expect(db_row).toMatchObject({unit: 'ora', payment_method: 'branch'});
			if (kind === 'melt') {
				expect(JSON.parse(db_row!.request)).toMatchObject({Custom: {method: 'branch', request: fixture.request}});
			}
			await openQuotes(page, kind);
			const row = page
				.locator('orc-mint-subsection-database-table tr.entity-row')
				.filter({has: page.locator('.mat-column-request', {hasText: fixture.request})})
				.first();
			const next_page = page.getByRole('button', {name: 'Next page'});
			while ((await row.count()) === 0 && (await next_page.isEnabled())) {
				const range = page.locator('.mat-mdc-paginator-range-label');
				const previous = await range.textContent();
				await next_page.click();
				await expect(range).not.toHaveText(previous ?? '');
			}
			await expect(row.locator('orc-mint-general-payment-method')).toHaveText('branch');
			await expect(row.locator('.mat-column-unit .text-sm')).toHaveText('ora');
			await row.click();
			const detail = page.locator(`orc-mint-subsection-database-table-${kind}`);
			await expect(detail.getByText('Payment Request', {exact: true})).toBeVisible();
			await expect(detail.locator('.w-max-36 .mega-string')).toHaveText(fixture.request);
			await expect(detail.locator('.qrcode-static svg')).toBeVisible();
			await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: config.orchardUrl});
			await detail.locator('.w-max-36 .button-copy-action').click();
			await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(fixture.request);
		});
	}
});
