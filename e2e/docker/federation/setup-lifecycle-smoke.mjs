import assert from 'node:assert/strict';
import {Client, credentials} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';
import {expect} from '@playwright/test';

const definitions = loadSync('proto/cdk/federation_setup.proto', {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
});
const methods = definitions['cdk_mint_federation_setup_v1.FederationSetupService'];

/** Inspect the actual mint wire response using Orchard's loader options. */
export async function setupRpc(member, method, request = {}) {
	const client = new Client(`127.0.0.1:${8090 + member}`, credentials.createInsecure());
	const definition = methods[method];
	try {
		return await new Promise((resolve, reject) =>
			client.makeUnaryRequest(
				definition.path,
				definition.requestSerialize,
				definition.responseDeserialize,
				request,
				{deadline: Date.now() + 30000},
				(error, response) => (error ? reject(error) : resolve(response)),
			),
		);
	} finally {
		client.close();
	}
}

/** Assert the distinction between ordinary enum defaults and absent optional enums. */
export async function checkUninitialized(member) {
	const state = await setupRpc(member, 'GetSetupStatus');
	assert.equal(state.initialized, false);
	assert.equal(state.role, 'SETUP_ROLE_UNSPECIFIED');
	assert.equal(state.participant_phase, 'SETUP_PARTICIPANT_PHASE_UNSPECIFIED');
	assert(!Object.hasOwn(state, 'coordinator_phase'));
	assert(!Object.hasOwn(state, 'setup_id'));
	assert(!Object.hasOwn(state, 'identity_fingerprint'));
	return state;
}

/** Create a disposable three-member ceremony through the wizard. */
export async function createSetup(page) {
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('button', {name: 'Fewer members', exact: true}).click({clickCount: 2});
	await expect(page.getByTestId('members-count')).toHaveText('3');
	await page.getByRole('button', {name: 'Lower signing threshold'}).click();
	await page.getByRole('button', {name: 'regtest', exact: true}).click();
	await page.getByLabel('Federation API URL, for other members', {exact: true}).fill('http://127.0.0.1:3351');
	await page.getByLabel('Allow local HTTP for development').check();
	const response = page.waitForResponse((response) => response.request().postData()?.includes('federation_setup_create') ?? false);
	await page.getByRole('button', {name: 'Create and get invitations'}).click();
	const created = (await (await response).json()).data?.federation_setup_create;
	assert.equal(created?.invitations?.length, 2);
	for (const invitation of created.invitations) assert(BigInt(invitation.expires_at_unix) > BigInt(Math.floor(Date.now() / 1000)));
	await expect(page.getByRole('heading', {name: 'Send each operator their invitation'})).toBeVisible();
	await expect(page.locator('#invitation-text')).toHaveValue(created.invitations[0].invitation);
	await expect(page.getByText(/^Expires /)).toBeVisible();
	await expect(page.getByTestId('identity-fingerprint')).toHaveText(/^[0-9a-f]{16}$/);
	return created;
}

/** Fill and submit the wizard's join form. */
async function submitJoin(page, member, invitation) {
	await page.getByRole('button', {name: 'Join', exact: true}).click();
	await page.getByLabel('Invitation', {exact: true}).fill(invitation);
	await page.getByLabel('Your federation API URL, for other members').fill(`http://127.0.0.1:${3350 + member}`);
	await page.getByLabel('Allow local HTTP for development').check();
	await page.getByRole('button', {name: 'Join federation', exact: true}).click();
}

/** Enroll a local member and read its fingerprint before a proposal exists. */
export async function joinSetup(page, member, invitation) {
	await submitJoin(page, member, invitation);
	await expect(page.getByRole('heading', {name: 'Waiting for the coordinator to propose', exact: true})).toBeVisible({timeout: 30000});
	const fingerprint = page.getByTestId('identity-fingerprint');
	await expect(fingerprint).toHaveText(/^[0-9a-f]{16}$/);
	return fingerprint.innerText();
}

/** Abort through the wizard's confirmation and return the status the page reads afterwards. */
async function abortSetup(page) {
	await page.getByRole('main').getByRole('button', {name: 'Abort setup', exact: true}).click();
	const response = page.waitForResponse((response) => response.request().postData()?.includes('federation_setup_status') ?? false);
	await page.getByRole('dialog').getByRole('button', {name: 'Abort setup', exact: true}).click();
	await expect(page.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
	return (await (await response).json()).data?.federation_setup_status;
}

/** Exercise replacement, a refused old invitation, and independent member/coordinator aborts. */
export async function checkSetupLifecycle(pages) {
	for (let member = 1; member <= 3; member++) await checkUninitialized(member);
	console.log(
		'PASS: raw loader defaults are SETUP_ROLE_UNSPECIFIED / SETUP_PARTICIPANT_PHASE_UNSPECIFIED; absent optional coordinator_phase is omitted',
	);
	const page = pages[0];
	const created = await createSetup(page);
	await page.reload();
	await expect(page.getByRole('heading', {name: 'Invitation unavailable'})).toBeVisible();
	await expect(page.locator('#invitation-text')).toHaveCount(0);
	const slot = page.locator('.member-slot').filter({hasText: 'Member 2'});
	await slot.getByRole('button', {name: 'Replace invitation', exact: true}).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('old invitation for member 2 stops working');
	const response = page.waitForResponse(
		(response) => response.request().postData()?.includes('federation_setup_replace_invitation') ?? false,
	);
	await dialog.getByRole('button', {name: 'Replace invitation', exact: true}).click();
	const replacement = (await (await response).json()).data?.federation_setup_replace_invitation?.invitation;
	assert(replacement);
	assert.notEqual(replacement.invitation, created.invitations[0].invitation);
	assert(BigInt(replacement.expires_at_unix) > BigInt(Math.floor(Date.now() / 1000)));
	await expect(page.locator('#invitation-text')).toHaveValue(replacement.invitation);
	// A member holding the replaced invitation sees the mint's refusal. cdk then can't report that member's status, so the
	// wizard never learns the setup ID to abort with; clean up over RPC until cdk reports local state.
	const stale = pages[2];
	await submitJoin(stale, 3, created.invitations[0].invitation);
	await expect(stale.locator('orc-error-resolve')).toBeVisible({timeout: 30000});
	await setupRpc(3, 'AbortSetup', {setup_id: created.setup_id});
	await checkUninitialized(3);
	await stale.reload();
	await expect(stale.getByRole('heading', {name: 'Your mint is ready to join a federation'})).toBeVisible();
	await joinSetup(pages[1], 2, replacement.invitation);
	await pages[1].getByRole('main').getByRole('button', {name: 'Abort setup', exact: true}).click();
	const abort_dialog = pages[1].getByRole('dialog');
	for (const text of ['cannot be undone', 'not notified', 'new setup ID']) await expect(abort_dialog).toContainText(text);
	await abort_dialog.screenshot({path: '/tmp/orchard-cdk-abort-dialog.png', animations: 'disabled'});
	await abort_dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
	await expect(abort_dialog).toHaveCount(0);
	const member_state = await abortSetup(pages[1]);
	assert.equal((await setupRpc(1, 'GetSetupStatus')).initialized, true);
	const coordinator_state = await abortSetup(page);
	for (const state of [member_state, coordinator_state]) {
		assert.equal(state.initialized, false);
		assert.equal(state.role, null);
		assert.equal(state.participant_phase, null);
		assert.equal(state.coordinator_phase, null);
	}
	console.log(
		'PASS: page refresh drops secrets; replacement expires as reported; an old invitation is refused; member/coordinator abort independently',
	);
	console.log('PASS: after abort the API reports initialized=false with absent role and phases');
	return created.setup_id;
}
