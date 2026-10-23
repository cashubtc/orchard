/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
/* Local Dependencies */
import type {CdkService as CdkServiceType} from './cdk.service.js';

jest.unstable_mockModule('#server/modules/cashu/mintdb/cashumintdb.helpers', () => ({
	buildDynamicQuery: jest.fn().mockReturnValue({sql: 'SQL', params: []}),
	buildCountQuery: jest.fn().mockReturnValue({sql: 'COUNTSQL', params: []}),
	queryRows: jest.fn(),
	queryRow: jest.fn().mockResolvedValue({count: 1}),
	extractRequestString: jest.fn().mockImplementation((s: string) => s?.replace(/^.*:/, '')),
	convertDateToUnixTimestamp: jest.fn((v: any) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : null)),
}));
const helpers = (await import('#server/modules/cashu/mintdb/cashumintdb.helpers')) as any;
const {CdkService} = await import('./cdk.service.js');

describe('CdkService', () => {
	let cdkService: CdkServiceType;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [CdkService],
		}).compile();

		jest.clearAllMocks();

		cdkService = module.get(CdkService);
	});

	it('should be defined', () => {
		expect(cdkService).toBeDefined();
	});

	it('listMeltQuotes maps request using extractRequestString', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{id: 'q1', request: 'bolt11:lnbc123', unit: 'sat', state: 'PAID', created_time: 1},
		]);
		const out = await cdkService.listMeltQuotes({} as any);
		expect(out[0].request).toBe('lnbc123');
	});

	it('listMeltQuotes leaves request unchanged when extractRequestString falsy', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{id: 'q1', request: 'nostr:xyz', unit: 'sat', state: 'PAID', created_time: 1},
		]);
		(helpers.extractRequestString as jest.Mock).mockReturnValueOnce('');
		const out = await cdkService.listMeltQuotes({} as any);
		expect(out[0].request).toBe('nostr:xyz');
	});

	it('listMeltQuotes propagates query error', async () => {
		(helpers.queryRows as jest.Mock).mockRejectedValueOnce(new Error('fail'));
		await expect(cdkService.listMeltQuotes({} as any)).rejects.toThrow('fail');
	});

	it('listProofGroups groups amounts and sums', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValue({sql: 'SQL', params: []});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{created_time: 10, keyset_id: 'k1', unit: 'sat', state: 'SPENT', amounts: '[1,2]'},
			{created_time: 10, keyset_id: 'k2', unit: 'sat', state: 'SPENT', amounts: '[3]'},
		]);
		const out = await cdkService.listProofGroups({} as any);
		expect(out).toHaveLength(1);
		expect(out[0].amount).toBe(6);
		expect(out[0].keyset_ids).toEqual(['k1', 'k2']);
	});

	it('listProofGroups supports array amounts, multiple groups and empty input', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValue({sql: 'SQL', params: []});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{created_time: 10, keyset_id: 'k1', unit: 'sat', state: 'SPENT', amounts: [1]},
			{created_time: 10, keyset_id: 'k2', unit: 'sat', state: 'SPENT', amounts: '[2]'},
			{created_time: 11, keyset_id: 'k9', unit: 'sat', state: 'SPENT', amounts: '[3]'},
		]);
		const out = await cdkService.listProofGroups({} as any);
		expect(out).toHaveLength(2);
		const g1 = out.find((g) => g.created_time === 10);
		expect(g1.amount).toBe(3);
		const g2 = out.find((g) => g.created_time === 11);
		expect(g2.amount).toBe(3);

		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		const empty = await cdkService.listProofGroups({} as any);
		expect(empty).toEqual([]);
	});

	it('listProofGroups rejects on invalid JSON amounts', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValue({sql: 'SQL', params: []});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{created_time: 10, keyset_id: 'k1', unit: 'sat', state: 'SPENT', amounts: 'not-json'},
		]);
		await expect(cdkService.listProofGroups({} as any)).rejects.toThrow();
	});

	/* Postgres returns BIGINT columns as strings; CDK service must coerce timestamp fields to numbers so that
	   downstream consumers (analytics, luxon) receive the declared `number` type. These tests feed string
	   timestamps to simulate the pg transport and assert the service repairs the type at its boundary. */

	it('listSwaps coerces string created_time from pg BIGINT to number', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{operation_id: 'op1', keyset_ids: 'k1,k2', unit: 'sat', amount: 100, created_time: '1745262864', fee: 0},
		]);
		const out = await cdkService.listSwaps({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
	});

	it('listMeltQuotes coerces string created_time and paid_time to number', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{id: 'q1', request: 'bolt11:lnbc', unit: 'sat', state: 'PAID', created_time: '1745262864', paid_time: '1745262900'},
		]);
		const out = await cdkService.listMeltQuotes({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
		expect(out[0].paid_time).toBe(1745262900);
	});

	it('listMeltQuotes preserves null paid_time', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{id: 'q1', request: 'bolt11:lnbc', unit: 'sat', state: 'UNPAID', created_time: 1, paid_time: null},
		]);
		const out = await cdkService.listMeltQuotes({} as any);
		expect(out[0].paid_time).toBeNull();
	});

	it('listMintQuotes coerces string timestamps and preserves nullable fields', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{
				id: 'q1',
				amount: 10,
				unit: 'sat',
				request: 'r',
				state: 'UNPAID',
				created_time: '1745262864',
				issued_time: null,
				paid_time: null,
			},
		]);
		const out = await cdkService.listMintQuotes({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
		expect(out[0].issued_time).toBeNull();
		expect(out[0].paid_time).toBeNull();
	});

	it('listProofs coerces string created_time', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{amount: 1, keyset_id: 'k1', unit: 'sat', state: 'SPENT', created_time: '1745262864'},
		]);
		const out = await cdkService.listProofs({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
	});

	it('listPromises coerces string created_time', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([{amount: 1, keyset_id: 'k1', unit: 'sat', created_time: '1745262864'}]);
		const out = await cdkService.listPromises({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
	});

	it('listProofGroups coerces string created_time on the grouped output', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{created_time: '1745262864', keyset_id: 'k1', unit: 'sat', state: 'SPENT', amounts: '[1]'},
		]);
		const out = await cdkService.listProofGroups({} as any);
		expect(typeof out[0].created_time).toBe('number');
		expect(out[0].created_time).toBe(1745262864);
	});

	it('listMintQuotes coerces string issued_time and paid_time when non-null', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{
				id: 'q1',
				amount: 10,
				unit: 'sat',
				request: 'r',
				state: 'ISSUED',
				created_time: '1745262864',
				issued_time: '1745262900',
				paid_time: '1745262899',
			},
		]);
		const out = await cdkService.listMintQuotes({} as any);
		expect(typeof out[0].issued_time).toBe('number');
		expect(out[0].issued_time).toBe(1745262900);
		expect(typeof out[0].paid_time).toBe('number');
		expect(out[0].paid_time).toBe(1745262899);
	});

	it('listMintQuotes treats undefined nullable fields as null', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{id: 'q1', amount: 10, unit: 'sat', request: 'r', state: 'UNPAID', created_time: 1},
		]);
		const out = await cdkService.listMintQuotes({} as any);
		expect(out[0].issued_time).toBeNull();
		expect(out[0].paid_time).toBeNull();
	});

	it('lookupMintQuote coerces string created_time and returns null when not found', async () => {
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({
			id: 'q1',
			amount: 10,
			unit: 'sat',
			request: 'r',
			state: 'UNPAID',
			created_time: '1745262864',
		});
		const out = await cdkService.lookupMintQuote({} as any, 'q1');
		expect(typeof out!.created_time).toBe('number');
		expect(out!.created_time).toBe(1745262864);

		(helpers.queryRow as jest.Mock).mockResolvedValueOnce(undefined);
		const missing = await cdkService.lookupMintQuote({} as any, 'missing');
		expect(missing).toBeNull();
	});

	it('lookupMeltQuote coerces string timestamps and preserves null paid_time', async () => {
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({
			id: 'q1',
			unit: 'sat',
			amount: 10,
			request: 'r',
			fee_reserve: 0,
			state: 'PAID',
			payment_preimage: null,
			request_lookup_id: null,
			msat_to_pay: null,
			created_time: '1745262864',
			paid_time: '1745262900',
			payment_method: 'bolt11',
		});
		const out = await cdkService.lookupMeltQuote({} as any, 'q1');
		expect(typeof out!.created_time).toBe('number');
		expect(out!.created_time).toBe(1745262864);
		expect(typeof out!.paid_time).toBe('number');
		expect(out!.paid_time).toBe(1745262900);

		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({
			id: 'q2',
			unit: 'sat',
			amount: 10,
			request: 'r',
			fee_reserve: 0,
			state: 'UNPAID',
			payment_preimage: null,
			request_lookup_id: null,
			msat_to_pay: null,
			created_time: 1,
			paid_time: null,
			payment_method: 'bolt11',
		});
		const unpaid = await cdkService.lookupMeltQuote({} as any, 'q2');
		expect(unpaid!.paid_time).toBeNull();

		(helpers.queryRow as jest.Mock).mockResolvedValueOnce(undefined);
		const missing = await cdkService.lookupMeltQuote({} as any, 'missing');
		expect(missing).toBeNull();
	});

	it('countMintQuotes and countMeltQuotes return row.count', async () => {
		(helpers.buildCountQuery as jest.Mock).mockReturnValueOnce({sql: 'SELECT 1;', params: ['a']});
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({count: 7});
		await expect(cdkService.countMintQuotes({} as any)).resolves.toBe(7);

		(helpers.buildCountQuery as jest.Mock).mockReturnValueOnce({sql: 'SELECT 2;', params: ['b']});
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({count: 5});
		await expect(cdkService.countMeltQuotes({} as any)).resolves.toBe(5);
	});

	it('balances and keysets pass-through queries', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValue([]);
		await cdkService.getBalances({} as any);
		let call = (helpers.queryRows as jest.Mock).mock.calls[(helpers.queryRows as jest.Mock).mock.calls.length - 1];
		expect(call[2]).toEqual([]);

		(helpers.queryRows as jest.Mock).mockResolvedValue([]);
		await cdkService.getBalances({} as any, 'kid');
		call = (helpers.queryRows as jest.Mock).mock.calls[(helpers.queryRows as jest.Mock).mock.calls.length - 1];
		expect(call[1]).toContain('WHERE ka.keyset_id = ?');
		expect(call[2]).toEqual(['kid']);

		(helpers.queryRows as jest.Mock).mockResolvedValue([]);
		await cdkService.getBalancesIssued({} as any);
		call = (helpers.queryRows as jest.Mock).mock.calls[(helpers.queryRows as jest.Mock).mock.calls.length - 1];
		expect(call[1]).toContain('total_issued AS balance');
		expect(call[1]).toContain('FROM keyset_amounts');

		(helpers.queryRows as jest.Mock).mockResolvedValue([]);
		await cdkService.getBalancesRedeemed({} as any);
		call = (helpers.queryRows as jest.Mock).mock.calls[(helpers.queryRows as jest.Mock).mock.calls.length - 1];
		expect(call[1]).toContain('total_redeemed AS balance');
		expect(call[1]).toContain('FROM keyset_amounts');

		(helpers.queryRows as jest.Mock).mockResolvedValue([]);
		await cdkService.getKeysets({} as any);
		call = (helpers.queryRows as jest.Mock).mock.calls[(helpers.queryRows as jest.Mock).mock.calls.length - 1];
		expect(call[1]).toContain('unit != ?');
		// NULLIF so a 0 (epoch) stamp reads as "no expiry", matching the nutshell mapper.
		expect(call[1]).toContain('NULLIF(valid_to, 0) AS final_expiry');
		expect(call[2]).toEqual(['auth']);
	});
});
