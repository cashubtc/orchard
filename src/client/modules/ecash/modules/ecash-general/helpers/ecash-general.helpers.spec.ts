/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
/* Shared Dependencies */
import {OrchardEcashOperation, WalletOperationState, WalletOperationType} from '@shared/generated.types';
/* Local Dependencies */
import {
	buildActivityGroups,
	buildAmountChars,
	buildBalanceCells,
	buildMintFeatures,
	buildUnitChips,
	getBalanceCellsWidth,
	getMintOnlineText,
	getMintStatusPill,
	getTimeOffsetLabel,
} from './ecash-general.helpers';

describe('buildUnitChips', () => {
	it('offers every unit at 0, sums balances across mints, and sorts bitcoin first', () => {
		const balances = [
			new EcashBalance({mint_id: 'a', unit: 'SAT', balance: 100}),
			new EcashBalance({mint_id: 'b', unit: 'sat', balance: 50}),
		];
		expect(buildUnitChips(['usd', 'eur', 'sat'], balances)).toEqual([
			{unit: 'sat', amount: 150},
			{unit: 'eur', amount: 0},
			{unit: 'usd', amount: 0},
		]);
	});

	it('adds units only held, not offered', () => {
		expect(buildUnitChips([], [new EcashBalance({mint_id: 'a', unit: 'usd', balance: 25})])).toEqual([{unit: 'usd', amount: 25}]);
	});
});

describe('buildAmountChars', () => {
	const render = (text: string, decimals: number, locale = 'en-US') =>
		buildAmountChars(text, decimals, locale)
			.map(({char, ghost}) => (ghost ? `(${char})` : char))
			.join('');

	it('shows a ghost zero until something is typed', () => {
		expect(render('', 0)).toBe('(0)');
	});

	it('groups whole amounts the way the locale does', () => {
		expect(render('1000000', 0)).toBe('1,000,000');
		expect(render('1000000', 0, 'de-DE')).toBe('1.000.000');
	});

	it('ghosts the fraction digits still to be typed after the decimal point', () => {
		expect(render('5.', 2)).toBe('5.(0)(0)');
		expect(render('5.2', 2)).toBe('5.2(0)');
		expect(render('1234.50', 2, 'de-DE')).toBe('1.234,50');
	});
});

describe('buildBalanceCells', () => {
	it('gives digits in any script a full cell and separators a narrow one', () => {
		const widths = (text: string) => buildBalanceCells(text).map((cell) => cell.width);
		expect(widths('2,100')).toEqual([0.665, 0.24, 0.665, 0.665, 0.665]);
		expect(widths('١٬٢٣')).toEqual([0.665, 0.24, 0.665, 0.665]);
		expect(getBalanceCellsWidth(buildBalanceCells('1.5'))).toBeCloseTo(1.57);
	});
});

describe('buildActivityGroups', () => {
	const now = DateTime.fromISO('2026-10-14T15:00:00', {zone: 'UTC', locale: 'en-US'});
	const operation = (created: string, overrides: Partial<OrchardEcashOperation> = {}) =>
		new EcashOperation({
			id: created,
			mint_id: 'mint-1',
			type: WalletOperationType.Issue,
			state: WalletOperationState.Finalized,
			unit: 'sat',
			amount: 2100,
			created_at: DateTime.fromISO(created, {zone: 'UTC'}).toUnixInteger(),
			updated_at: 0,
			...overrides,
		});

	it('groups the past week by day and older operations by month, timing rows to fit their group', () => {
		const operations = [
			operation('2026-10-14T14:02'),
			operation('2026-10-14T11:20'),
			operation('2026-10-13T18:40'),
			operation('2026-10-12T09:15'),
			operation('2026-10-08T08:00'),
			operation('2026-10-07T08:00'),
			operation('2026-09-28T08:00'),
			operation('2025-12-03T08:00'),
		];
		const groups = buildActivityGroups(operations, null, now);
		expect(groups.map((group) => group.label)).toEqual([
			'today',
			'yesterday',
			'Monday',
			'Thursday',
			'October',
			'September',
			'December 2025',
		]);
		expect(groups[0].rows.map((row) => row.time)).toEqual([
			jasmine.stringMatching(/^2:02\sPM$/),
			jasmine.stringMatching(/^11:20\sAM$/),
		]);
		expect(groups.slice(4).map((group) => group.rows[0].time)).toEqual(['Oct 7', 'Sep 28', 'Dec 3']);
	});

	it('reads each row from its kind, state and payment method', () => {
		const [{rows}] = buildActivityGroups(
			[
				operation('2026-10-14T14:05', {memo: 'Meetup prizes'}),
				operation('2026-10-14T14:04', {state: WalletOperationState.Executing}),
				operation('2026-10-14T14:03', {state: WalletOperationState.Failed, error: 'Mint unreachable', memo: 'Raffle'}),
				operation('2026-10-14T14:02', {type: WalletOperationType.Mint, method: 'bolt12'}),
				operation('2026-10-14T14:01', {type: WalletOperationType.Mint, method: 'branch'}),
			],
			null,
			now,
		);
		expect(rows.map(({title, subtitle, progress}) => ({title, subtitle, progress}))).toEqual([
			{title: 'Issued', subtitle: 'Meetup prizes', progress: 'done'},
			{title: 'Issuing', subtitle: null, progress: 'open'},
			{title: 'Issue failed', subtitle: 'Mint unreachable', progress: 'failed'},
			{title: 'Received', subtitle: null, progress: 'done'},
			{title: 'Received', subtitle: null, progress: 'done'},
		]);
		expect(rows.map((row) => row.method)).toEqual([
			{label: 'Ecash', icon: 'payments', svg_icon: false},
			{label: 'Ecash', icon: 'payments', svg_icon: false},
			{label: 'Ecash', icon: 'payments', svg_icon: false},
			{label: 'BOLT 12', icon: 'double_bolt', svg_icon: true},
			{label: 'BRANCH', icon: 'money_bag', svg_icon: false},
		]);
	});

	it('converts bitcoin amounts at the oracle price, except for failed operations', () => {
		const [{rows}] = buildActivityGroups(
			[
				operation('2026-10-14T14:03'),
				operation('2026-10-14T14:02', {unit: 'usd', amount: 500}),
				operation('2026-10-14T14:01', {state: WalletOperationState.Failed}),
			],
			100_000,
			now,
		);
		expect(rows.map((row) => row.amount_oracle)).toEqual([210, null, null]);
	});
});

describe('mint info helpers', () => {
	const info = new MintInfo({
		nuts: {
			nut4: {
				disabled: false,
				methods: [
					{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
					{method: 'onchain', unit: 'sat', min_amount: 10000, max_amount: null},
				],
			},
			nut5: {disabled: false, methods: []},
			nut7: {supported: true},
			nut15: {methods: []},
			nut17: {supported: [{method: 'bolt11', unit: 'sat', commands: ['bolt11_mint_quote']}]},
			nut21: {openid_discovery: 'https://auth.example', client_id: 'cashu', protected_endpoints: []},
		},
	});

	it('names every optional NUT as the config page does, offered whenever the mint lists it', () => {
		const features = buildMintFeatures(info.nuts);
		const offered = (nut: string) => features.find((feature) => feature.nut === nut)?.supported;
		expect(features.length).toBe(14);
		expect(features[0]).toEqual({label: 'Token check', nut: 'NUT-07', supported: true});
		expect([offered('NUT-08'), offered('NUT-15'), offered('NUT-17'), offered('NUT-21'), offered('NUT-22')]).toEqual([
			false,
			true,
			true,
			true,
			false,
		]);
	});

	it('keeps a known status while statuses load, checking only a mint with none yet', () => {
		const statuses = [new EcashMintStatus({mint_id: 'cedar', online: true, latency_ms: 84, error: null, checked_at: 0})];
		expect(getMintStatusPill(statuses, 'cedar', true)).toEqual({state: 'active', text: 'Online · 84 ms', error: null});
		expect(getMintStatusPill(statuses, 'kelp', true)).toEqual({state: 'loading', text: 'Checking', error: null});
		expect(getMintStatusPill(statuses, 'kelp', false)).toEqual({state: 'disabled', text: 'Unknown', error: null});
	});

	it('reads an online mint with its round trip when known', () => {
		expect(getMintOnlineText(84)).toBe('Online · 84 ms');
		expect(getMintOnlineText(null)).toBe('Online');
	});

	it("describes the mint's clock only when it is more than a minute ahead or behind", () => {
		expect(getTimeOffsetLabel(null)).toBeNull();
		expect(getTimeOffsetLabel(-45)).toBeNull();
		expect(getTimeOffsetLabel(180)).toBe('3 min ahead of Orchard');
		expect(getTimeOffsetLabel(-7200)).toBe('2 h behind Orchard');
	});
});
