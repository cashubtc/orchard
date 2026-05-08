/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
/* Local Dependencies */
import {MintSubsectionKeysetsTableRow} from './mint-subsection-keysets-table-row.class';

describe('MintSubsectionKeysetsTableRow', () => {
	const KEYSET_ID = '0187b2e8000000fe6074';

	const buildKeyset = (overrides: Partial<MintKeyset> = {}): MintKeyset =>
		new MintKeyset({
			id: KEYSET_ID,
			active: true,
			derivation_path: "m/0'/0'/0'",
			derivation_path_index: 0,
			input_fee_ppk: 100,
			unit: 'sat',
			valid_from: 1777504327,
			valid_to: null,
			fees_paid: 199,
			amounts: [1, 2, 4, 8],
			...overrides,
		} as any);

	const analytic = (amount: string, date: number): MintAnalyticKeyset => new MintAnalyticKeyset({keyset_id: KEYSET_ID, amount, date});

	const buildCount = (proof_count = 43, promise_count = 83): MintKeysetCount =>
		new MintKeysetCount({id: KEYSET_ID, proof_count, promise_count});

	describe('balance', () => {
		it('sums all main + pre amounts (server pre-nets issued − redeemed per bucket)', () => {
			// Real-world e2e fixture: pre is empty (mint genesis inside the page range), main has the netted bucket.
			const main = [analytic('4680', 1777503600)];
			const pre: MintAnalyticKeyset[] = [];

			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), main, pre, buildCount());

			expect(row.balance).toBe(4680);
		});

		it('sums across multiple netted buckets in main', () => {
			const main = [analytic('300', 1777503600), analytic('200', 1777507200), analytic('-50', 1777510800)];
			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), main, [], buildCount());

			expect(row.balance).toBe(450);
		});

		it('combines pre (history) and main (current range)', () => {
			const pre = [analytic('1000', 1500000000)];
			const main = [analytic('500', 1777503600), analytic('-200', 1777507200)];

			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), main, pre, buildCount());

			expect(row.balance).toBe(1300);
		});

		it('returns 0 when both arrays are empty', () => {
			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), [], [], buildCount());

			expect(row.balance).toBe(0);
		});

		it('returns negative balance when redeemed exceeds issued historically', () => {
			const pre = [analytic('-100', 1500000000)];
			const main = [analytic('-50', 1777503600)];

			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), main, pre, buildCount());

			expect(row.balance).toBe(-150);
		});

		it('handles BigInt arithmetic for amounts beyond Number.MAX_SAFE_INTEGER', () => {
			const huge = '9007199254740993'; // MAX_SAFE_INTEGER + 2
			const main = [analytic(huge, 1777503600)];

			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), main, [], buildCount());

			expect(row.balance).toBe(Number(BigInt(huge)));
		});
	});

	describe('keyset metadata', () => {
		it('copies non-balance fields from the keyset and count', () => {
			const keyset = buildKeyset({active: false, derivation_path_index: 1, input_fee_ppk: 50, fees_paid: 1234});
			const row = new MintSubsectionKeysetsTableRow(keyset, [], [], buildCount(43, 83));

			expect(row.id).toBe(KEYSET_ID);
			expect(row.active).toBe(false);
			expect(row.derivation_path_index).toBe(1);
			expect(row.input_fee_ppk).toBe(50);
			expect(row.fees_paid).toBe(1234);
			expect(row.proof_count).toBe(43);
			expect(row.promise_count).toBe(83);
		});

		it('falls back to zero counts when no MintKeysetCount is provided', () => {
			const row = new MintSubsectionKeysetsTableRow(buildKeyset(), [], [], undefined);

			expect(row.proof_count).toBe(0);
			expect(row.promise_count).toBe(0);
		});
	});
});
