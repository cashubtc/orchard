// @ts-check
/** Real ora/branch fixtures. CDK owns the wallet; Pecan acts as the teller. */
import {execFile} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';

/** @typedef {{quote: string, amount: number, request: string}} QuoteFixture */
/** @typedef {{quote?: string, amount?: number, request?: string, state?: string, balance?: number}} WalletResponse */
const exec_file = promisify(execFile);

/** @param {string} name @returns {string} */
function requiredEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required for Pecan fixtures`);
	return value;
}

const mint_url = requiredEnv('MINT_URL');
const pecan_url = requiredEnv('PECAN_URL');
const method = requiredEnv('MINT_METHOD');
let session_cookie = '';

/** Call Pecan with its session cookie and retain actionable API errors.
 * @param {string} path @param {Record<string, unknown> | undefined} [body]
 * @returns {Promise<{id?: string}>} */
async function teller(path, body) {
	const response = await fetch(`${pecan_url}${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: {'content-type': 'application/json', cookie: session_cookie},
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(15000),
	});
	const cookie = response.headers.get('set-cookie');
	if (cookie) session_cookie = cookie.split(';')[0];
	const result = await response.json();
	if (!response.ok) throw new Error(`Pecan ${path}: HTTP ${response.status}: ${JSON.stringify(result)}`);
	return result;
}

/** Sign into the test-only teller, completing its required first password change. */
async function login() {
	const password = requiredEnv('PECAN_PASSWORD');
	try {
		await teller('/api/login', {username: 'admin', password});
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes('HTTP 401:')) throw error;
		const initial_password = requiredEnv('PECAN_INITIAL_PASSWORD');
		await teller('/api/login', {username: 'admin', password: initial_password});
		await teller('/api/me/password', {
			current_password: initial_password,
			password,
			password_confirm: password,
		});
	}
}

/** Run a bounded wallet operation; never print proofs or wallet secrets.
 * @param {string[]} args @returns {Promise<WalletResponse>} */
async function wallet(...args) {
	const {stdout} = await exec_file('pecan-wallet', args, {timeout: 90000});
	return JSON.parse(stdout);
}

/** Create a quote and validate the fields needed for teller settlement.
 * @param {string[]} args @returns {Promise<QuoteFixture>} */
async function createQuote(...args) {
	const result = await wallet(...args);
	if (typeof result.quote !== 'string' || typeof result.amount !== 'number') {
		throw new Error('Wallet returned an invalid quote');
	}
	return {quote: result.quote, amount: result.amount, request: result.request ?? args[2] ?? ''};
}

/** Read the mint's authoritative quote state.
 * @param {'mint' | 'melt'} kind @param {string} quote_id
 * @returns {Promise<{state?: string, amount_paid?: number}>} */
async function quote(kind, quote_id) {
	const response = await fetch(`${mint_url}/v1/${kind}/quote/${method}/${encodeURIComponent(quote_id)}`, {
		signal: AbortSignal.timeout(10000),
	});
	const result = await response.json();
	if (!response.ok) throw new Error(`CDK ${kind} quote: HTTP ${response.status}: ${JSON.stringify(result)}`);
	return result;
}

/** Wait for a specific settlement state without relying on fixed sleeps.
 * @param {string} description @param {() => Promise<boolean>} ready */
async function waitFor(description, ready) {
	const deadline = Date.now() + 45000;
	while (Date.now() < deadline) {
		if (await ready()) return;
		await delay(250);
	}
	throw new Error(`Timed out waiting for ${description}; inspect Pecan and CDK logs`);
}

/** Match the wallet's quote and settle through Pecan's normal teller API.
 * @param {string} quote_id @param {'paid' | 'failed'} outcome */
async function settle(quote_id, outcome) {
	const ticket = await teller('/api/quotes/match', {code: quote_id});
	if (typeof ticket.id !== 'string') throw new Error('Pecan match returned no ticket id');
	await teller(`/api/tickets/${encodeURIComponent(ticket.id)}/mark-${outcome}`, {notes: 'Orchard e2e fixture'});
}

/** Create and claim a real teller-paid deposit.
 * @param {number} amount @returns {Promise<QuoteFixture>} */
async function deposit(amount) {
	const created = await createQuote('mint-quote', String(amount));
	await settle(created.quote, 'paid');
	await waitFor(`deposit ${created.quote} payment`, async () => (await quote('mint', created.quote)).amount_paid === amount);
	const issued = await wallet('mint', created.quote);
	if (issued.amount !== amount) throw new Error(`Deposit issued ${issued.amount}, expected ${amount}`);
	return created;
}

/** Submit a withdrawal, prove it reaches PENDING, then settle it as teller.
 * @param {number} amount @param {'paid' | 'failed'} outcome
 * @returns {Promise<QuoteFixture & {state: string}>} */
async function withdraw(amount, outcome) {
	const request = `Orchard e2e ${outcome} withdrawal ${Date.now()}`;
	const created = await createQuote('melt-quote', String(amount), request);
	// Observe rejections immediately so a delayed teller response cannot leave
	// an unhandled promise rejection or an orphaned wallet process.
	const completion = wallet('melt', created.quote).then(
		(value) => ({value, error: undefined}),
		(error) => ({value: undefined, error}),
	);
	try {
		await waitFor(`withdrawal ${created.quote} to reach PENDING`, async () => (await quote('melt', created.quote)).state === 'PENDING');
		await settle(created.quote, outcome);
	} finally {
		const result = await completion;
		if (outcome === 'paid' && result.error) throw result.error;
		if (outcome === 'paid' && result.value?.state !== 'PAID') throw new Error('Wallet did not finalize the paid withdrawal');
	}
	const state = outcome === 'paid' ? 'PAID' : 'UNPAID';
	await waitFor(`withdrawal ${created.quote} to become ${state}`, async () => (await quote('melt', created.quote)).state === state);
	return {...created, request, state};
}

/** Add another repeatable activity batch while retaining the funded wallet. */
async function seed() {
	const deposits = [];
	for (const amount of [2048, 1024, 512]) deposits.push(await deposit(amount));
	for (let index = 0; index < 2; index++) await wallet('swap');
	const withdrawals = [await withdraw(128, 'paid'), await withdraw(64, 'paid')];
	const unpaid = await createQuote('mint-quote', '123');
	const voided = await withdraw(32, 'failed');
	const balance = await wallet('balance');
	const fixtures = {deposits, withdrawals, unpaid, voided, balance: balance.balance};
	await writeFile('/wallet/fixtures.json', `${JSON.stringify(fixtures, null, 2)}\n`);
	console.log(JSON.stringify(fixtures));
}

if (process.env.ACTIVITY_SKIP === '1') {
	console.log('ACTIVITY_SKIP=1 — no Pecan activity generated');
} else {
	await login();
	await seed();
}
