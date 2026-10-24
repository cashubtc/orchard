import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';

// Run only against the disposable federation stack after dev.sh reset.
const browser = await chromium.launch({headless: true, channel: process.env.CHROME_CHANNEL || 'chrome'});
const pages = [];
const queries = [[], [], []];
const failures = [];
const password = 'FederationWizardTest2026!';

/** Observe operation names and errors without logging invitation-bearing payloads. */
function observe(page, index) {
	page.on('request', (request) => {
		if (request.method() === 'POST' && request.url().endsWith('/api')) queries[index].push(request.postDataJSON().query || '');
	});
	page.on('pageerror', (error) => failures.push(error.message));
}

/** Assert the rendered viewport has no horizontal overflow. */
async function checkWidth(page) {
	assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page overflows horizontally');
}

try {
	for (let index = 0; index < 3; index++) {
		const base = `http://127.0.0.1:${3361 + index}`;
		const denied = await fetch(`${base}/api`, {
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({query: '{ federation_setup_status { initialized } }'}),
		}).then((response) => response.json());
		assert.equal(denied.errors?.[0]?.extensions?.code, 10002);
		const page = await browser.newPage({viewport: index === 1 ? {width: 390, height: 844} : {width: 1440, height: 1000}});
		pages.push(page);
		observe(page, index);
		await page.goto(base);
		await page.waitForURL('**/auth/setup');
		await page.getByLabel('Setup Key').fill('orchard-e2e-admin-key');
		await page.getByLabel('Username').fill(`wizard-admin-${index + 1}`);
		await page.getByLabel('Password', {exact: true}).fill(password);
		await page.getByLabel('Confirm Password').fill(password);
		await page.getByRole('button', {name: /start/i}).click();
		await page.waitForURL((url) => !url.pathname.includes('/auth/setup'));
		await expect(page.getByRole('heading', {name: 'Federation setup', exact: true})).toBeVisible();
		assert(
			!queries[index].some((query) => /\bmint_info\b|\bmint_activity_summary\b|\bmint_balances\b/.test(query)),
			'Home/layout called unavailable mint APIs',
		);
		await page.goto(`${base}/mint/info`);
		await page.waitForURL('**/mint/federation');
		await expect(page.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
	}
	console.log('PASS: authentication, setup-only routes, quiet home/layout');
	const coordinator = pages[0];
	await coordinator.setViewportSize({width: 390, height: 844});
	await checkWidth(coordinator);
	await coordinator.setViewportSize({width: 1440, height: 1000});
	await coordinator.getByRole('button', {name: 'Create', exact: true}).click();
	await coordinator.getByRole('button', {name: 'Fewer members', exact: true}).click({clickCount: 2});
	await expect(coordinator.getByTestId('members-count')).toHaveText('3');
	await coordinator.getByRole('button', {name: 'Lower signing threshold'}).click();
	await coordinator.getByRole('button', {name: 'regtest', exact: true}).click();
	await coordinator.getByLabel('Federation API URL, for other members', {exact: true}).fill('http://127.0.0.1:3351');
	await coordinator.getByLabel('Allow local HTTP for development').check();
	const created_response = coordinator.waitForResponse(
		(response) => response.request().postData()?.includes('federation_setup_create') ?? false,
	);
	await coordinator.getByRole('button', {name: 'Create and get invitations'}).click();
	const created = (await (await created_response).json()).data?.federation_setup_create;
	assert(created?.invitations?.length === 2, 'Create did not return two invitations');
	await expect(coordinator.getByRole('heading', {name: 'Send each operator their invitation'})).toBeVisible();
	await expect(coordinator.getByRole('button', {name: 'Propose once everyone has joined'})).toBeDisabled();
	await coordinator.reload();
	await expect(coordinator.locator('#invitation-text')).toHaveValue(created.invitations[0].invitation);
	console.log('PASS: create and invitation retention across page refresh');
	for (let index = 1; index < 3; index++) {
		const page = pages[index];
		await page.getByRole('button', {name: 'Join', exact: true}).click();
		await page
			.getByLabel('Invitation', {exact: true})
			.fill(created.invitations.find((invitation) => invitation.member_id === index + 1).invitation);
		await page.getByLabel('Your federation API URL, for other members').fill(`http://127.0.0.1:${3351 + index}`);
		await page.getByLabel('Allow local HTTP for development').check();
		await page.getByRole('button', {name: 'Join federation', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Waiting for the coordinator to propose', exact: true})).toBeVisible({
			timeout: 30000,
		});
	}
	await expect(coordinator.getByRole('button', {name: 'Propose federation', exact: true})).toBeEnabled({timeout: 30000});
	await expect(coordinator.locator('#invitation-text')).toHaveCount(0);
	await coordinator.getByRole('button', {name: 'Propose federation', exact: true}).click();
	const hashes = [];
	for (const [index, page] of pages.entries()) {
		await expect(page.getByRole('heading', {name: 'Review the proposal', exact: true})).toBeVisible({timeout: 30000});
		hashes.push(await page.locator('orc-federation-setup-review code').innerText());
		await expect(page.getByRole('button', {name: 'Check every member to approve'})).toBeDisabled();
		if (index === 1) {
			await expect(page.locator('orc-nav-secondary')).toHaveClass(/collapsed/);
			await checkWidth(page);
			await page.screenshot({path: '/tmp/orchard-m3-mobile-review.png', fullPage: true});
		}
		await page.getByRole('checkbox').nth(0).check();
		await page.getByRole('checkbox').nth(1).check();
		await expect(page.getByRole('button', {name: 'Check every member to approve'})).toBeDisabled();
		await page.getByRole('checkbox').nth(2).check();
		await expect(page.getByRole('button', {name: 'Approve proposal', exact: true})).toBeEnabled();
	}
	assert(
		hashes.every((hash) => hash === hashes[0]),
		'Members saw different proposal hashes',
	);
	await coordinator.locator('.setup-container').evaluate((element) => {
		element.scrollTop = 0;
	});
	await coordinator.screenshot({path: '/tmp/orchard-m3-desktop-review.png', fullPage: true});
	for (const index of [1, 2, 0]) await pages[index].getByRole('button', {name: 'Approve proposal', exact: true}).click();
	console.log('PASS: enrollment, proposal, identical hashes, all-fingerprint approval gate, phone layout');
	for (const page of pages)
		await expect(page.getByRole('button', {name: 'Activate my mint', exact: true})).toBeEnabled({timeout: 180000});
	for (const page of pages) {
		await page.getByRole('button', {name: 'Activate my mint', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Back up before using real funds'})).toBeVisible({timeout: 30000});
		await expect(page.getByRole('button', {name: 'Open the mint', exact: true})).toBeDisabled();
	}
	for (const page of pages) {
		await expect(page.getByText('Member mode confirmed.', {exact: true})).toBeVisible({timeout: 90000});
		// Synthetic test data only: this tests the acknowledgments, not a real backup or restore.
		for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
		await expect(page.getByRole('button', {name: 'Open the mint', exact: true})).toBeEnabled();
	}
	assert.deepEqual(failures, [], 'Unexpected browser errors');
	console.log('PASS: all three members generated keys, activated, confirmed member mode and enforced backup acknowledgments');
} finally {
	await browser.close();
}
