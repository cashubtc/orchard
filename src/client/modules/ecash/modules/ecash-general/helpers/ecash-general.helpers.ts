/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {compareUnits} from '@client/modules/local/helpers/unit.helpers';
import {getNumberSeparator} from '@client/modules/local/helpers/local.helpers';
import {oracleConvertToUSDCents} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {isNutOffered} from '@client/modules/mint/helpers/mint-nut.helpers';
import {MINT_NUT_TITLES} from '@client/modules/mint/constants/mint.constants';
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintNut} from '@client/modules/mint/types/nut.types';
import {CashuUnitChip} from '@client/modules/cashu/types/cashu.types';
import {getCashuMethodDisplay} from '@client/modules/cashu/helpers/cashu.helpers';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {
	ACTIVITY_KINDS,
	BALANCE_DIGIT_EM,
	BALANCE_SEPARATOR_EM,
	MINT_TIME_SYNC_S,
} from '@client/modules/ecash/modules/ecash-general/constants/ecash-general.constants';
import {
	EcashActivityGroup,
	EcashActivityProgress,
	EcashActivityRow,
	EcashAmountChar,
	EcashBalanceCell,
	EcashMintFeature,
	EcashMintLimitGroup,
	EcashMintStatusPill,
} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method, OrchardNuts, WalletOperationState} from '@shared/generated.types';

/**
 * A mint's status pill: online with latency or unreachable with the reason, checking while a mint with no status yet is being checked
 * @param {EcashMintStatus[]} statuses - Every wallet mint's last probe
 * @param {string} mint_id - The mint to describe
 * @param {boolean} loading - Whether statuses are loading
 * @returns {EcashMintStatusPill} The pill's state, text and error
 */
export function getMintStatusPill(statuses: EcashMintStatus[], mint_id: string, loading: boolean): EcashMintStatusPill {
	const status = statuses.find((item) => item.mint_id === mint_id);
	if (!status) return loading ? {state: 'loading', text: 'Checking', error: null} : {state: 'disabled', text: 'Unknown', error: null};
	if (status.online) return {state: 'active', text: getMintOnlineText(status.latency_ms), error: null};
	return {state: 'inactive', text: 'Unreachable', error: status.error};
}

/**
 * How an online mint reads, with its round trip when known
 * @param {number | null} latency_ms - The mint's round trip, null when unknown
 * @returns {string} "Online", with the latency when known
 */
export function getMintOnlineText(latency_ms: number | null): string {
	return latency_ms === null ? 'Online' : `Online · ${latency_ms} ms`;
}

/**
 * One chip per unit offered or held, with the balances summed, bitcoin first
 * @param {string[]} units - Units the mints offer
 * @param {EcashBalance[]} balances - Wallet balances per mint and unit
 * @returns {Required<CashuUnitChip>[]} The chips; 0 for units with no balance
 */
export function buildUnitChips(units: string[], balances: EcashBalance[]): Required<CashuUnitChip>[] {
	const totals = new Map<string, number>(units.map((unit) => [unit.toLowerCase(), 0]));
	for (const {unit, balance} of balances) {
		const key = unit.toLowerCase();
		totals.set(key, (totals.get(key) ?? 0) + balance);
	}
	return [...totals].map(([unit, amount]) => ({unit, amount})).sort((a, b) => compareUnits(a.unit, b.unit));
}

/**
 * Lays a formatted balance out in fixed-width cells, so its digits don't shift while it counts
 * @param {string} text - The balance in the locale's format
 * @returns {EcashBalanceCell[]} Each character with its cell width in ems
 */
export function buildBalanceCells(text: string): EcashBalanceCell[] {
	return [...text].map((char) => ({char, width: /\p{Nd}/u.test(char) ? BALANCE_DIGIT_EM : BALANCE_SEPARATOR_EM}));
}

/**
 * How wide a balance's cells are together
 * @param {EcashBalanceCell[]} cells - The balance's cells
 * @returns {number} The width in ems
 */
export function getBalanceCellsWidth(cells: EcashBalanceCell[]): number {
	return cells.reduce((width, cell) => width + cell.width, 0);
}

/**
 * Lays a typed amount out character by character in the locale's format
 * @param {string} text - The amount typed so far, with '.' as its decimal point
 * @param {number} decimals - Fraction digits the unit allows
 * @param {string} locale - Locale for digit grouping and the decimal separator
 * @returns {EcashAmountChar[]} The characters, with ghost zeros for an empty amount and untyped fraction digits
 */
export function buildAmountChars(text: string, decimals: number, locale: string): EcashAmountChar[] {
	const [integer, fraction] = text.split('.');
	const typed = (value: string): EcashAmountChar[] => [...value].map((char) => ({char, ghost: false}));
	const ghosts = (count: number): EcashAmountChar[] => Array.from({length: count}, () => ({char: '0', ghost: true}));
	const chars = integer ? typed(Number(integer).toLocaleString(locale)) : ghosts(1);
	if (fraction === undefined || decimals === 0) return chars;
	return [...chars, ...typed(getNumberSeparator(locale, 'decimal')), ...typed(fraction), ...ghosts(decimals - fraction.length)];
}

/**
 * Groups operations by day for the past week, then by month, each row timed to fit its group
 * @param {EcashOperation[]} operations - Operations, newest first
 * @param {number | null} oracle_price - Latest bitcoin price in USD, for the conversions under bitcoin amounts
 * @param {DateTime} now - The current time, in the zone and locale to show
 * @returns {EcashActivityGroup[]} The groups, newest first
 */
export function buildActivityGroups(operations: EcashOperation[], oracle_price: number | null, now: DateTime): EcashActivityGroup[] {
	const groups: EcashActivityGroup[] = [];
	const today = now.startOf('day');
	for (const operation of operations) {
		const created = DateTime.fromSeconds(operation.created_at, {zone: now.zone, locale: now.locale ?? undefined});
		const days = Math.round(today.diff(created.startOf('day'), 'days').days);
		const recent = days < 7;
		const key = created.toFormat(recent ? 'yyyy-MM-dd' : 'yyyy-MM');
		const time = recent ? created.toLocaleString(DateTime.TIME_SIMPLE) : created.toLocaleString({month: 'short', day: 'numeric'});
		const row = buildActivityRow(operation, oracle_price, time);
		const group = groups.at(-1);
		if (group?.key === key) group.rows.push(row);
		else groups.push({key, label: getActivityGroupLabel(created, now, days, recent), rows: [row]});
	}
	return groups;
}

/**
 * Names an activity group: relative for today and yesterday, the weekday within a week, the month after that
 * @param {DateTime} created - When the group's first operation was created
 * @param {DateTime} now - The current time
 * @param {number} days - Calendar days between the two
 * @param {boolean} recent - Whether the group is a day within the past week
 * @returns {string} The group label
 */
function getActivityGroupLabel(created: DateTime, now: DateTime, days: number, recent: boolean): string {
	if (days < 2) return created.toRelativeCalendar({base: now, unit: 'days'}) ?? '';
	if (recent) return created.toFormat('cccc');
	return created.toLocaleString(created.year === now.year ? {month: 'long'} : {month: 'long', year: 'numeric'});
}

/**
 * Lays one operation out for its activity row
 * @param {EcashOperation} operation - The operation
 * @param {number | null} oracle_price - Latest bitcoin price in USD
 * @param {string} time - When it happened, as its group shows it
 * @returns {EcashActivityRow} The row
 */
function buildActivityRow(operation: EcashOperation, oracle_price: number | null, time: string): EcashActivityRow {
	const kind = ACTIVITY_KINDS[operation.type];
	const progress = getActivityProgress(operation.state);
	const failed = progress === 'failed';
	return {
		operation,
		time,
		title: kind.titles[progress],
		subtitle: failed ? operation.error : operation.memo,
		method: kind.method ?? getCashuMethodDisplay(operation.method),
		progress,
		amount_oracle: failed ? null : oracleConvertToUSDCents(operation.amount, oracle_price, operation.unit),
	};
}

/**
 * Where an operation stands, from its saga state
 * @param {WalletOperationState} state - The operation's state
 * @returns {EcashActivityProgress} Done, open or failed
 */
function getActivityProgress(state: WalletOperationState): EcashActivityProgress {
	if (state === WalletOperationState.Finalized) return 'done';
	if (state === WalletOperationState.Failed) return 'failed';
	return 'open';
}

/**
 * A mint's minting and melting limits per method and unit, leaving out a side with no methods
 * @param {MintInfo} info - The mint's info
 * @returns {EcashMintLimitGroup[]} Minting then melting
 */
export function buildMintLimits(info: MintInfo): EcashMintLimitGroup[] {
	const group = (label: string, methods: (OrchardNut4Method | OrchardNut5Method)[]) => ({
		label,
		limits: methods.map((method) => ({
			method: getCashuMethodDisplay(method.method),
			unit: method.unit,
			min: method.min_amount ?? null,
			max: method.max_amount ?? null,
		})),
	});
	return [group(MINT_NUT_TITLES.nut4, info.nuts.nut4.methods), group(MINT_NUT_TITLES.nut5, info.nuts.nut5.methods)].filter(
		(limit_group) => limit_group.limits.length > 0,
	);
}

/**
 * Every optional NUT, named as on the mint's config page, and whether the mint offers it
 * @param {OrchardNuts} nuts - The mint's NUT settings
 * @returns {EcashMintFeature[]} One feature per NUT beyond minting and melting
 */
export function buildMintFeatures(nuts: OrchardNuts): EcashMintFeature[] {
	return (Object.keys(MINT_NUT_TITLES) as MintNut[])
		.filter((nut) => nut !== 'nut4' && nut !== 'nut5')
		.map((nut) => ({label: MINT_NUT_TITLES[nut], nut: `NUT-${nut.slice(3).padStart(2, '0')}`, supported: isNutOffered(nuts[nut])}));
}

/**
 * How far a mint's clock is from Orchard's, only when it is out of sync by more than a minute
 * @param {number | null} offset - Seconds the mint's clock is ahead, negative when behind; null when it sends no time
 * @returns {string | null} The offset in words, or null when in sync or not reported
 */
export function getTimeOffsetLabel(offset: number | null): string | null {
	if (offset === null || Math.abs(offset) <= MINT_TIME_SYNC_S) return null;
	const minutes = Math.round(Math.abs(offset) / 60);
	const amount = minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
	return `${amount} ${offset > 0 ? 'ahead of' : 'behind'} Orchard`;
}
