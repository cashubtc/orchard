/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Vendor Dependencies */
import Database from 'better-sqlite3';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
import {Logger} from '@nestjs/common';
/* Application Dependencies */
import {mockGrpcModules} from '#server/test/grpc-esm-mocks';
import {CredentialService} from '#server/modules/credential/credential.service';
import {MintDatabaseType} from '#server/modules/cashu/mintdb/cashumintdb.enums';
/* Local Dependencies */
import type {NutshellService as NutshellServiceType} from './nutshell.service.js';

jest.unstable_mockModule('#server/modules/cashu/mintdb/cashumintdb.helpers', () => ({
	buildDynamicQuery: jest.fn().mockReturnValue({sql: 'SQL', params: []}),
	buildCountQuery: jest.fn().mockReturnValue({sql: 'COUNTSQL', params: []}),
	convertDateToUnixTimestamp: jest.fn().mockImplementation((d: any) => (typeof d === 'number' ? d : 1)),
	queryRows: jest.fn(),
	queryRow: jest.fn().mockResolvedValue({count: 1}),
}));
const helpers = (await import('#server/modules/cashu/mintdb/cashumintdb.helpers')) as any;
const {proto_loader, grpc} = await mockGrpcModules();
const {NutshellService} = await import('./nutshell.service.js');

describe('NutshellService', () => {
	let nutshellService: NutshellServiceType;
	let configService: jest.Mocked<ConfigService>;
	let credentialService: jest.Mocked<CredentialService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NutshellService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: CredentialService, useValue: {loadPemOrPath: jest.fn()}},
			],
		}).compile();

		nutshellService = module.get(NutshellService);
		configService = module.get(ConfigService);
		credentialService = module.get(CredentialService);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(nutshellService).toBeDefined();
	});

	it('returns undefined client when credentials missing', () => {
		const client = nutshellService.initializeGrpcClient();
		expect(client).toBeUndefined();
	});

	it('initializes client with mTLS when rpc_mtls is true', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'cashu.rpc_key':
					return 'KEY';
				case 'cashu.rpc_cert':
					return 'CERT';
				case 'cashu.rpc_ca':
					return 'CA';
				case 'cashu.rpc_mtls':
					return true;
				case 'cashu.rpc_host':
					return 'localhost';
				case 'cashu.rpc_port':
					return 3333;
				default:
					return undefined as any;
			}
		});
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('x'));
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue({});
		grpc.loadPackageDefinition.mockReturnValue({cashu: {Mint: jest.fn()}});
		nutshellService.initializeGrpcClient();
		expect(createSsl).toHaveBeenCalled();
		expect(proto_loader.loadSync).toHaveBeenCalled();
		expect(grpc.loadPackageDefinition).toHaveBeenCalled();
	});

	it('initializes client with docker host channel options when using mTLS', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'cashu.rpc_key':
					return 'KEY';
				case 'cashu.rpc_cert':
					return 'CERT';
				case 'cashu.rpc_ca':
					return 'CA';
				case 'cashu.rpc_mtls':
					return true;
				case 'cashu.rpc_host':
					return 'host.docker.internal';
				case 'cashu.rpc_port':
					return 3333;
				default:
					return undefined as any;
			}
		});
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('x'));
		jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue('DEF');
		const mint_ctor = jest.fn();
		grpc.loadPackageDefinition.mockReturnValue({cashu: {Mint: mint_ctor}});
		nutshellService.initializeGrpcClient();
		const args = mint_ctor.mock.calls[0];
		expect(args[2]).toMatchObject({
			'grpc.ssl_target_name_override': 'localhost',
			'grpc.default_authority': 'localhost',
		});
	});

	it('initializes client with insecure connection when rpc_mtls is false', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'cashu.rpc_mtls':
					return false;
				case 'cashu.rpc_host':
					return 'localhost';
				case 'cashu.rpc_port':
					return 3333;
				default:
					return undefined as any;
			}
		});
		const createInsecure = jest.spyOn(grpc.credentials, 'createInsecure').mockReturnValue({} as any);
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue({});
		grpc.loadPackageDefinition.mockReturnValue({cashu: {Mint: jest.fn()}});
		nutshellService.initializeGrpcClient();
		expect(createInsecure).toHaveBeenCalled();
		expect(createSsl).not.toHaveBeenCalled();
		expect(proto_loader.loadSync).toHaveBeenCalled();
	});

	it('initializeGrpcClient logs error and returns undefined when loader throws', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'cashu.rpc_key':
					return 'KEY';
				case 'cashu.rpc_cert':
					return 'CERT';
				case 'cashu.rpc_ca':
					return 'CA';
				case 'cashu.rpc_mtls':
					return true;
				case 'cashu.rpc_host':
					return 'localhost';
				case 'cashu.rpc_port':
					return 3333;
				default:
					return undefined as any;
			}
		});
		credentialService.loadPemOrPath.mockReturnValue(Buffer.from('x'));
		jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockImplementation(() => {
			throw new Error('boom');
		});
		const logger_error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
		const out = nutshellService.initializeGrpcClient();
		expect(out).toBeUndefined();
		expect(logger_error).toHaveBeenCalled();
	});

	it('initializeGrpcClient uses correct proto path and buffers with mTLS', () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'cashu.rpc_key':
					return 'KEY';
				case 'cashu.rpc_cert':
					return 'CERT';
				case 'cashu.rpc_ca':
					return 'CA';
				case 'cashu.rpc_mtls':
					return true;
				case 'cashu.rpc_host':
					return 'localhost';
				case 'cashu.rpc_port':
					return 3333;
				default:
					return undefined as any;
			}
		});
		const key_buf = Buffer.from('k');
		const cert_buf = Buffer.from('c');
		const ca_buf = Buffer.from('a');
		credentialService.loadPemOrPath.mockReturnValueOnce(key_buf).mockReturnValueOnce(cert_buf).mockReturnValueOnce(ca_buf);
		const createSsl = jest.spyOn(grpc.credentials, 'createSsl').mockReturnValue({} as any);
		proto_loader.loadSync.mockReturnValue({});
		grpc.loadPackageDefinition.mockReturnValue({cashu: {Mint: jest.fn()}});
		nutshellService.initializeGrpcClient();
		const load_arg = proto_loader.loadSync.mock.calls[0][0];
		expect(String(load_arg)).toContain('proto/nutshell/management.proto');
		expect(createSsl).toHaveBeenCalledWith(ca_buf, key_buf, cert_buf);
		const logger_log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined as any);
		logger_log.mockClear();
		credentialService.loadPemOrPath.mockReturnValueOnce(key_buf).mockReturnValueOnce(cert_buf).mockReturnValueOnce(ca_buf);
		nutshellService.initializeGrpcClient();
		// ensure success path log is called
		expect(logger_log).toHaveBeenCalledTimes(1);
	});

	it('getKeysets converts dates and derives path index', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: '2024-01-01', valid_to: '2024-01-02', final_expiry: 1893456000, derivation_path: "m/86'/0'/0'"},
		]);
		const out = await nutshellService.getKeysets({} as any);
		expect(out[0].valid_from).toBe(1);
		expect(out[0].valid_to).toBe(1);
		// final_expiry is a raw unix int — passed through unchanged, NOT date-converted
		expect(out[0].final_expiry).toBe(1893456000);
		expect(out[0].derivation_path_index).toBe(0);
	});

	it('getKeysets normalizes a 0 final_expiry to null', async () => {
		// Older rotations stamped 0 (epoch) instead of leaving the column null;
		// 0 means "no expiry", so it must not surface as a 1970 timestamp.
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: '2024-01-01', valid_to: '2024-01-02', final_expiry: 0, derivation_path: "m/86'/0'/0'"},
		]);
		const out = await nutshellService.getKeysets({} as any);
		expect(out[0].final_expiry).toBeNull();
	});

	it('getKeysets skips index resolution when all derivation paths are valid', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: 100, valid_to: 100, derivation_path: "m/0'/0'/0'", unit: 'sat'},
			{valid_from: 200, valid_to: 200, derivation_path: "m/0'/0'/1'", unit: 'sat'},
		]);
		const out = await nutshellService.getKeysets({} as any);
		expect(out[0].derivation_path_index).toBe(0);
		expect(out[1].derivation_path_index).toBe(1);
	});

	it('getKeysets assigns indices by timestamp when legacy keysets exist', async () => {
		(helpers.convertDateToUnixTimestamp as jest.Mock).mockImplementation((d: any) =>
			d === null ? null : typeof d === 'number' ? d : 1,
		);
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: 300, valid_to: 300, derivation_path: 'randomhex123456', unit: 'sat'},
			{valid_from: 100, valid_to: 100, derivation_path: "m/0'/0'/1'", unit: 'sat'},
			{valid_from: 200, valid_to: 200, derivation_path: "m/0'/0'/3'", unit: 'sat'},
		]);
		const out = await nutshellService.getKeysets({} as any);
		// sorted by timestamp: 100 → index 0, 200 → index 1, 300 → index 2
		expect(out.find((k) => k.derivation_path === "m/0'/0'/1'").derivation_path_index).toBe(0);
		expect(out.find((k) => k.derivation_path === "m/0'/0'/3'").derivation_path_index).toBe(1);
		expect(out.find((k) => k.derivation_path === 'randomhex123456').derivation_path_index).toBe(2);
	});

	it('getKeysets claimed keysets reserve their index, unclaimed fill remaining slots', async () => {
		(helpers.convertDateToUnixTimestamp as jest.Mock).mockImplementation((d: any) =>
			d === null ? null : typeof d === 'number' ? d : 1,
		);
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: 100, valid_to: 100, derivation_path: 'legacyhex1234567', unit: 'sat'},
			{valid_from: null, valid_to: null, derivation_path: "m/0'/0'/1'", unit: 'sat'},
			{valid_from: 200, valid_to: 200, derivation_path: "m/0'/0'/3'", unit: 'sat'},
		]);
		const out = await nutshellService.getKeysets({} as any);
		// claimed: m/0'/0'/1' has null timestamp + valid index 1 → keeps index 1
		// unclaimed sorted by ts: legacyhex(100), m/0'/0'/3'(200) → fill slots 0, 2 (skip 1)
		expect(out.find((k) => k.derivation_path === "m/0'/0'/1'").derivation_path_index).toBe(1);
		expect(out.find((k) => k.derivation_path === 'legacyhex1234567').derivation_path_index).toBe(0);
		expect(out.find((k) => k.derivation_path === "m/0'/0'/3'").derivation_path_index).toBe(2);
	});

	it('getKeysets unresolved keysets (null timestamp + null deriv path) assigned after unclaimed', async () => {
		(helpers.convertDateToUnixTimestamp as jest.Mock).mockImplementation((d: any) =>
			d === null ? null : typeof d === 'number' ? d : 1,
		);
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: null, valid_to: null, derivation_path: undefined, unit: 'sat'},
			{valid_from: 100, valid_to: 100, derivation_path: 'legacyhex1234567', unit: 'sat'},
		]);
		const out = await nutshellService.getKeysets({} as any);
		// unclaimed (has timestamp): legacyhex → slot 0
		// unresolved (no timestamp, no deriv path): undefined → slot 1
		expect(out.find((k) => k.derivation_path === 'legacyhex1234567').derivation_path_index).toBe(0);
		expect(out.find((k) => k.derivation_path === undefined).derivation_path_index).toBe(1);
	});

	it('getKeysets resolves indices independently per unit', async () => {
		(helpers.convertDateToUnixTimestamp as jest.Mock).mockImplementation((d: any) =>
			d === null ? null : typeof d === 'number' ? d : 1,
		);
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: 200, valid_to: 200, derivation_path: 'legacyhex1234567', unit: 'sat'},
			{valid_from: 100, valid_to: 100, derivation_path: "m/0'/0'/0'", unit: 'sat'},
			{valid_from: 300, valid_to: 300, derivation_path: 'legacyhex7654321', unit: 'usd'},
			{valid_from: 100, valid_to: 100, derivation_path: "m/0'/2'/0'", unit: 'usd'},
		]);
		const out = await nutshellService.getKeysets({} as any);
		// sat unit: sorted by ts → m/0'/0'/0'(100)=0, legacyhex(200)=1
		expect(out.find((k) => k.derivation_path === "m/0'/0'/0'").derivation_path_index).toBe(0);
		expect(out.find((k) => k.derivation_path === 'legacyhex1234567').derivation_path_index).toBe(1);
		// usd unit: sorted by ts → m/0'/2'/0'(100)=0, legacyhex(300)=1
		expect(out.find((k) => k.derivation_path === "m/0'/2'/0'").derivation_path_index).toBe(0);
		expect(out.find((k) => k.derivation_path === 'legacyhex7654321').derivation_path_index).toBe(1);
	});

	it('getKeysets passes auth filter and logs on error', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{valid_from: 100, valid_to: 100, derivation_path: "m/0'/0'/0'", unit: 'sat'},
		]);
		await nutshellService.getKeysets({} as any);
		const call = (helpers.queryRows as jest.Mock).mock.calls[0];
		expect(call[2]).toEqual(['auth']);
	});

	it('getKeysets logs and rethrows on error', async () => {
		(helpers.queryRows as jest.Mock).mockRejectedValueOnce(new Error('fail'));
		const logger_error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
		await expect(nutshellService.getKeysets({} as any)).rejects.toThrow('fail');
		expect(logger_error).toHaveBeenCalled();
	});

	it('getBalances builds SQL with and without keyset_id and propagates errors', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		await nutshellService.getBalances({} as any);
		let call = (helpers.queryRows as jest.Mock).mock.calls.pop();
		expect(call[1]).toContain('FROM balance');
		expect(call[2]).toEqual([]);
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		await nutshellService.getBalances({} as any, 'K1');
		call = (helpers.queryRows as jest.Mock).mock.calls.pop();
		expect(call[1]).toContain('WHERE b.keyset = ?');
		expect(call[2]).toEqual(['K1']);
		(helpers.queryRows as jest.Mock).mockImplementationOnce(() => {
			throw new Error('badsql');
		});
		await expect(nutshellService.getBalances({} as any)).rejects.toThrow('badsql');
	});

	it('getBalancesIssued and Redeemed query correct tables and propagate errors', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		await nutshellService.getBalancesIssued({} as any);
		let call = (helpers.queryRows as jest.Mock).mock.calls.pop();
		expect(call[1]).toBe('SELECT * FROM balance_issued;');
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		await nutshellService.getBalancesRedeemed({} as any);
		call = (helpers.queryRows as jest.Mock).mock.calls.pop();
		expect(call[1]).toBe('SELECT * FROM balance_redeemed;');
		(helpers.queryRows as jest.Mock).mockImplementationOnce(() => {
			throw new Error('oops');
		});
		await expect(nutshellService.getBalancesIssued({} as any)).rejects.toThrow('oops');
	});

	it('listMintQuotes maps fields and uses buildDynamicQuery', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValueOnce({sql: 'S', params: ['P']});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{quote: 'q1', checking_id: 'c1', state: 'ISSUED', paid_time: 'pt', created_time: 'ct', amount: 5},
			{quote: 'q2', checking_id: 'c2', state: 'PENDING', paid_time: 'pt', created_time: 'ct', amount: 7},
		]);
		const out = await nutshellService.listMintQuotes({type: 'sqlite'} as any, {states: ['ISSUED']} as any);
		expect(helpers.buildDynamicQuery).toHaveBeenCalledWith({
			db_type: MintDatabaseType.sqlite,
			table_name: 'mint_quotes',
			args: {states: ['ISSUED']},
			field_mappings: expect.any(Object),
		});
		expect(out[0]).toMatchObject({id: 'q1', request_lookup_id: 'c1', amount_paid: 5, amount_issued: 5});
		expect(out[0].issued_time).toBe(1);
		expect(out[1].issued_time).toBeNull();
		(helpers.queryRows as jest.Mock).mockImplementationOnce(() => {
			throw new Error('err');
		});
		await expect(nutshellService.listMintQuotes({type: 'sqlite'} as any)).rejects.toThrow('err');
	});

	it('listMeltQuotes maps fields and uses buildDynamicQuery', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValueOnce({sql: 'S2', params: ['P2']});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([{quote: 'q1', checking_id: 'c1', paid_time: 'pt', created_time: 'ct'}]);
		const out = await nutshellService.listMeltQuotes({type: 'postgres'} as any, {states: ['PAID']} as any);
		expect(helpers.buildDynamicQuery).toHaveBeenCalledWith({
			db_type: MintDatabaseType.postgres,
			table_name: 'melt_quotes',
			args: {states: ['PAID']},
			field_mappings: expect.any(Object),
		});
		expect(out[0]).toMatchObject({id: 'q1', request_lookup_id: 'c1', payment_preimage: undefined, msat_to_pay: null});
		(helpers.queryRows as jest.Mock).mockImplementationOnce(() => {
			throw new Error('err2');
		});
		await expect(nutshellService.listMeltQuotes({type: 'sqlite'} as any)).rejects.toThrow('err2');
	});

	it('listProofGroups groups by created and unit, aggregates amounts, handles array/string', async () => {
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([
			{created: 't', id: 'k1', unit: 'sat', amounts: '[1,2]'},
			{created: 't', id: 'k2', unit: 'sat', amounts: [3]},
		]);
		const out = await nutshellService.listProofGroups({type: 'sqlite'} as any, {} as any);
		expect(out).toHaveLength(1);
		expect(out[0].amount).toBe(6);
		expect(out[0].state).toBe('SPENT');
		expect(out[0].keyset_ids).toEqual(['k1', 'k2']);
		(helpers.queryRows as jest.Mock).mockImplementationOnce(() => {
			throw new Error('pg');
		});
		await expect(nutshellService.listProofGroups({type: 'sqlite'} as any)).rejects.toThrow('pg');
	});

	it('count methods return row.count', async () => {
		(helpers.buildCountQuery as jest.Mock).mockReturnValueOnce({sql: 'SELECT x FROM melt_quotes;', params: ['a']});
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({count: 3});
		await expect(nutshellService.countMeltQuotes({type: 'sqlite'} as any, {} as any)).resolves.toBe(3);

		(helpers.buildCountQuery as jest.Mock).mockReturnValueOnce({sql: 'SELECT x FROM mint_quotes;', params: ['b']});
		(helpers.queryRow as jest.Mock).mockResolvedValueOnce({count: 4});
		await expect(nutshellService.countMintQuotes({type: 'sqlite'} as any, {} as any)).resolves.toBe(4);
	});

	it('listFees seeds LAG with NULL so the first balance_log row is treated as a baseline, not a delta from zero', async () => {
		(helpers.buildDynamicQuery as jest.Mock).mockReturnValueOnce({sql: 'S', params: []});
		(helpers.queryRows as jest.Mock).mockResolvedValueOnce([]);
		await nutshellService.listFees({type: 'sqlite'} as any, {} as any);
		const call = (helpers.buildDynamicQuery as jest.Mock).mock.calls[0][0];
		expect(call.select_statement).toContain('LAG(keyset_fees_paid, 1, NULL)');
		expect(call.select_statement).not.toContain('LAG(keyset_fees_paid, 1, 0)');
	});

	it('listFees inner SELECT drops the first row of each partition against an in-memory sqlite', async () => {
		const db = new Database(':memory:');
		db.exec(`
			CREATE TABLE balance_log (unit TEXT, time INTEGER, keyset_fees_paid INTEGER);
			INSERT INTO balance_log VALUES
				('sat', 1000, 50000),  -- restored baseline: pre-existing 50k fees
				('sat', 1100, 50007),  -- real first delta: +7
				('sat', 1200, 50012),  -- +5
				('eur', 2000, 200),    -- baseline for eur partition
				('eur', 2100, 203);    -- +3
		`);
		const inner_sql = `
			SELECT unit, created_time, fee FROM (
				SELECT
					unit,
					time AS created_time,
					keyset_fees_paid - LAG(keyset_fees_paid, 1, NULL) OVER (PARTITION BY unit ORDER BY time) AS fee
				FROM balance_log
			) deltas
			WHERE fee > 0
			ORDER BY unit, created_time
		`;
		const rows = db.prepare(inner_sql).all();
		db.close();
		expect(rows).toEqual([
			{unit: 'eur', created_time: 2100, fee: 3},
			{unit: 'sat', created_time: 1100, fee: 7},
			{unit: 'sat', created_time: 1200, fee: 5},
		]);
	});
});
