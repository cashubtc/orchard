import {checkSetupLifecycle, createSetup, joinSetup, fingerprint_pattern} from './setup-lifecycle-smoke.mjs';
import {checkMemberDashboard} from './dashboard-smoke.mjs';
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

/** Exercise an unreachable optional connection, then restore the stack's mint-only configuration. */
async function checkOnboardingConnection(page, base) {
	const picker = page.locator('orc-onboarding-picker');
	const mint = picker.getByRole('button', {name: /Mint/});
	const bitcoin = picker.getByRole('button', {name: /Bitcoin/});
	await expect(mint).toHaveAttribute('aria-pressed', 'true');
	await mint.click();
	await bitcoin.click();
	await expect(bitcoin).toHaveAttribute('aria-pressed', 'true');
	await picker.getByRole('button', {name: /Continue with 1 service/}).click();
	await page.waitForURL((url) => url.pathname === '/onboarding/configure/bitcoin');
	const configure = page.locator('orc-onboarding-configure');
	await configure.getByLabel('RPC host', {exact: true}).fill('127.0.0.1');
	await configure.getByLabel('RPC port', {exact: true}).fill('1');
	await configure.getByLabel('RPC user', {exact: true}).fill('smoke-user');
	await configure.getByLabel('RPC password', {exact: true}).fill('smoke-password');
	const tested_response = page.waitForResponse((response) => response.request().postData()?.includes('service_connection_test') ?? false);
	await configure.getByRole('button', {name: /^Test (connection|again)$/}).click();
	const tested = (await (await tested_response).json()).data?.service_connection_test;
	assert.equal(tested?.ok, false, 'The deliberately unavailable Bitcoin port unexpectedly connected');
	assert.equal(tested?.saved, false);
	await expect(configure.getByRole('heading', {name: "Couldn't connect to Bitcoin Core", exact: true})).toBeVisible();
	await expect(configure.getByLabel('RPC port', {exact: true})).toHaveValue('1');
	const saved_response = page.waitForResponse(
		(response) => response.request().postData()?.includes('service_configuration_save') ?? false,
	);
	await configure.getByRole('button', {name: 'Save without a working connection', exact: true}).click();
	const saved = (await (await saved_response).json()).data?.service_configuration_save;
	assert.equal(saved?.saved, true, 'Save without a working connection did not persist');
	assert.equal(saved?.ok, false);
	await page.waitForURL((url) => url.pathname === '/onboarding/review');
	await expect(page.getByRole('heading', {name: 'Review your setup', exact: true})).toBeVisible();
	const bitcoin_row = page.locator('orc-onboarding-review [data-service="bitcoin"]');
	await expect(bitcoin_row).toContainText('Saved without a working connection');
	await expect(bitcoin_row).toContainText(':1');
	await page.getByRole('button', {name: 'Open Orchard'}).click();
	await page.waitForURL('**/mint/federation');
	await expect(page.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
	await page.goto(`${base}/settings/services`);
	await page.getByRole('button', {name: 'Edit Bitcoin', exact: true}).click();
	const editor = page.locator('orc-service-editor');
	await expect(editor.getByRole('heading', {name: 'Edit Bitcoin', exact: true})).toBeVisible();
	await editor.getByRole('button', {name: 'Remove Bitcoin', exact: true}).click();
	const confirmation = page.getByRole('dialog').filter({has: page.getByRole('heading', {name: 'Remove Bitcoin?', exact: true})});
	const removed_response = page.waitForResponse(
		(response) => response.request().postData()?.includes('service_configuration_remove') ?? false,
	);
	await confirmation.getByRole('button', {name: 'Remove Bitcoin', exact: true}).click();
	assert.equal((await (await removed_response).json()).data?.service_configuration_remove, true);
	await expect(editor.getByRole('status')).toContainText('Bitcoin removed');
	await editor.getByRole('button', {name: 'Done', exact: true}).click();
	await expect(page.getByRole('button', {name: 'Add Bitcoin', exact: true})).toBeVisible();
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
		await page.waitForURL((url) => url.pathname === '/onboarding/services');
		if (index === 0) await checkOnboardingConnection(page, base);
		else {
			await page.getByRole('button', {name: 'Skip for now', exact: true}).click();
			await page.waitForURL('**/mint/federation');
			await expect(page.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
		}
		await page.goto(`${base}/`);
		await expect(page.getByRole('heading', {name: 'Federation setup', exact: true})).toBeVisible();
		assert(
			!queries[index].some((query) => /\bmint_info\b|\bmint_activity_summary\b|\bmint_balances\b/.test(query)),
			'Home/layout called unavailable mint APIs',
		);
		await page.goto(`${base}/mint/info`);
		await page.waitForURL('**/mint/federation');
		await expect(page.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
	}
	console.log('PASS: authentication, onboarding failed test/save anyway/review/open/removal, setup-only routes, quiet home/layout');
	const coordinator = pages[0];
	await coordinator.setViewportSize({width: 390, height: 844});
	await checkWidth(coordinator);
	await coordinator.setViewportSize({width: 1440, height: 1000});
	const aborted_setup_id = await checkSetupLifecycle(pages);
	const created = await createSetup(coordinator);
	assert.notEqual(created.setup_id, aborted_setup_id, 'A new ceremony reused the aborted setup ID');
	await expect(coordinator.getByRole('button', {name: 'Propose once everyone has joined'})).toBeDisabled();
	const fingerprints = [await coordinator.getByTestId('identity-fingerprint').innerText()];
	for (let index = 1; index < 3; index++) {
		fingerprints.push(
			await joinSetup(
				pages[index],
				index + 1,
				created.invitations.find((invitation) => invitation.member_id === index + 1).invitation,
			),
		);
	}
	for (const fingerprint of fingerprints) assert.match(fingerprint, fingerprint_pattern);
	await expect(coordinator.getByRole('button', {name: 'Propose federation', exact: true})).toBeEnabled({timeout: 30000});
	await expect(coordinator.getByLabel('Invitation', {exact: true})).toHaveCount(0);
	await coordinator.getByRole('button', {name: 'Propose federation', exact: true}).click();
	const hashes = [];
	for (const [index, page] of pages.entries()) {
		await expect(page.getByRole('heading', {name: 'Review the proposal', exact: true})).toBeVisible({timeout: 30000});
		hashes.push(await page.getByTestId('proposal-hash').innerText());
		for (const fingerprint of fingerprints) await expect(page.locator('orc-federation-setup-review')).toContainText(fingerprint);
		const review = page.locator('orc-federation-setup-review');
		const own_card = review
			.getByRole('article')
			.filter({has: page.getByRole('heading', {name: `Member ${index + 1} · This is you`, exact: true})});
		await expect(own_card).toHaveCount(1);
		await expect(own_card.getByRole('checkbox')).toHaveCount(0);
		await expect(review.getByRole('checkbox')).toHaveCount(2);
		await expect(page.getByRole('button', {name: 'Check every member to approve'})).toBeDisabled();
		if (index === 1) {
			await expect(page.locator('orc-nav-secondary')).toHaveClass(/collapsed/);
			await checkWidth(page);
			await page.screenshot({path: '/tmp/orchard-m3-mobile-review.png', fullPage: true});
		}
		const other_members = [1, 2, 3].filter((member) => member !== index + 1);
		await review.getByRole('checkbox', {name: `Checked member ${other_members[0]} with its operator`, exact: true}).check();
		await expect(page.getByRole('button', {name: 'Check every member to approve'})).toBeDisabled();
		await review.getByRole('checkbox', {name: `Checked member ${other_members[1]} with its operator`, exact: true}).check();
		await expect(page.getByRole('button', {name: 'Approve proposal', exact: true})).toBeEnabled();
	}
	assert(
		hashes.every((hash) => hash === hashes[0]),
		'Members saw different proposal hashes',
	);
	await coordinator.getByTestId('setup-container').evaluate((element) => {
		element.scrollTop = 0;
	});
	await coordinator.screenshot({path: '/tmp/orchard-m3-desktop-review.png', fullPage: true});
	for (const index of [1, 2, 0]) await pages[index].getByRole('button', {name: 'Approve proposal', exact: true}).click();
	console.log('PASS: enrollment, proposal, identical hashes, other-member fingerprint approval gate, phone layout');
	for (const page of pages)
		await expect(page.getByRole('button', {name: 'Activate my mint', exact: true})).toBeEnabled({timeout: 180000});
	for (const page of pages) {
		await expect(page.getByRole('button', {name: 'Abort setup', exact: true})).toHaveCount(0);
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
	for (const [index, page] of pages.entries()) await checkMemberDashboard(page, index);
	assert.deepEqual(failures, [], 'Unexpected browser errors');
	console.log('PASS: all three members generated keys, activated, confirmed member mode and enforced backup acknowledgments');
} finally {
	await browser.close();
}
