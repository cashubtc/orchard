/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
/* Native Dependencies */
import {CashuWalletCounter} from '#server/modules/cashu/wallet/saga/cashuwalletcounter.entity';
/* Local Dependencies */
import {CashuWalletCounterSource} from './cashu-wallet-counter-source.class.js';

describe('CashuWalletCounterSource', () => {
	let data_source: DataSource;
	let source: CashuWalletCounterSource;

	const cursors = async () =>
		Object.fromEntries((await data_source.getRepository(CashuWalletCounter).find()).map((row) => [row.counter_key, row.next]));

	beforeEach(async () => {
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities: [CashuWalletCounter], synchronize: true});
		await data_source.initialize();
		source = new CashuWalletCounterSource(data_source.getRepository(CashuWalletCounter), 'user-1');
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('reserves ranges that never overlap, per keyset and per user', async () => {
		expect(await source.reserve('00000000000000aa', 3)).toEqual({start: 0, count: 3});
		expect(await source.reserve('00000000000000aa', 2)).toEqual({start: 3, count: 2});
		expect(await source.reserve('00000000000000bb', 1)).toEqual({start: 0, count: 1});
		const other = new CashuWalletCounterSource(data_source.getRepository(CashuWalletCounter), 'user-2');
		expect(await other.reserve('00000000000000aa', 1)).toEqual({start: 0, count: 1});
	});

	it('shares one cursor between keysets that derive the same secrets', async () => {
		await source.reserve('0000000000000001', 2);
		expect(await source.reserve('0000000080000000', 1)).toEqual({start: 2, count: 1});
	});

	it('peeks the cursor without moving it when reserving none', async () => {
		expect(await source.reserve('00000000000000aa', 0)).toEqual({start: 0, count: 0});
		await source.reserve('00000000000000aa', 4);
		expect(await source.reserve('00000000000000aa', 0)).toEqual({start: 4, count: 0});
	});

	it('only ever moves a cursor up', async () => {
		await source.advanceToAtLeast('00000000000000aa', 7);
		await source.advanceToAtLeast('00000000000000aa', 3);
		expect(await source.reserve('00000000000000aa', 0)).toEqual({start: 7, count: 0});
	});

	it('keeps named cursors apart from keyset ones', async () => {
		expect(await source.reserveCursor('nut20', 1)).toEqual({start: 0, count: 1});
		expect(await source.reserveCursor('nut20', 1)).toEqual({start: 1, count: 1});
		expect(await cursors()).toEqual({nut20: 2});
	});
});
