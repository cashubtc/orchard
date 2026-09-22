/**
 * Harness probe — proves the supertest tier is wired end-to-end against a
 * running Orchard stack. Requires `npm run e2e:up <config>` first.
 */

/* Native Dependencies */
import {getActiveConfig} from '../helpers/context';
import {gql} from '../helpers/gql';
import {loginAsAdmin} from '../helpers/login';

/* Application Dependencies */
import {btc} from '../../helpers/backend';
import {agree} from '../../helpers/agree';

describe('harness probe — supertest tier', () => {
	const config = getActiveConfig();
	const bitcoin_test = config.bitcoin ? it : it.skip;

	it('reaches Orchard GraphQL and parses a public query', async () => {
		const data = await gql<{auth_initialization: {initialization: boolean}}>(`
			query { auth_initialization { initialization } }
		`);
		expect(typeof data.auth_initialization.initialization).toBe('boolean');
	});

	it('seeds admin (if needed) and issues a JWT pair', async () => {
		const tokens = await loginAsAdmin();
		expect(tokens.access_token).toMatch(/^ey/);
		expect(tokens.refresh_token).toMatch(/^ey/);
	});

	it('exercises bearer auth against a guarded resolver', async () => {
		const {access_token} = await loginAsAdmin();
		const data = await gql<{mint_keysets: Array<{id: string; unit: string}>}>(`query { mint_keysets { id unit } }`, {}, access_token);
		expect(data.mint_keysets.length).toBeGreaterThan(0);
	});

	bitcoin_test('reaches the bitcoind container via docker exec', () => {
		const height = btc.blockCount(config);
		expect(height).toBeGreaterThanOrEqual(0);
	});

	bitcoin_test('Orchard block count agrees with bitcoind', async () => {
		const {access_token} = await loginAsAdmin();
		const orchard = await gql<{bitcoin_blockcount: {height: number}}>(`query { bitcoin_blockcount { height } }`, {}, access_token);
		const backend = btc.blockCount(config);
		agree('chain height', orchard.bitcoin_blockcount.height, backend);
	});
});
