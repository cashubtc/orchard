/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
/* Vendor Dependencies */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
/* Application Dependencies */
import {CredentialService} from '@server/modules/credential/credential.service';
/* Native Dependencies */
import {
	CashuMintDatabase,
	CashuMintBalance,
	CashuMintKeyset,
	CashuMintMeltQuote,
	CashuMintMintQuote,
	CashuMintProofGroup,
	CashuMintProof,
	CashuMintPromise,
	CashuMintSwap,
	CashuMintCount,
	CashuMintOperationFee,
} from '@server/modules/cashu/mintdb/cashumintdb.types';
import {
	CashuMintMintQuotesArgs,
	CashuMintMeltQuotesArgs,
	CashuMintProofsArgs,
	CashuMintPromiseArgs,
	CashuMintSwapsArgs,
	CashuMintFeesArgs,
} from '@server/modules/cashu/mintdb/cashumintdb.interfaces';
import {
	buildDynamicQuery,
	buildCountQuery,
	queryRows,
	queryRow,
	extractRequestString,
	convertDateToUnixTimestamp,
} from '@server/modules/cashu/mintdb/cashumintdb.helpers';
import {MintDatabaseType} from '@server/modules/cashu/mintdb/cashumintdb.enums';
/* Local Dependencies */
import {CdkMintProof} from './cdk.types.js';

@Injectable()
export class CdkService {
	private readonly logger = new Logger(CdkService.name);

	constructor(
		private configService: ConfigService,
		private credentialService: CredentialService,
	) {}

	public initializeGrpcClient(): grpc.Client {
		const rpc_key = this.configService.get('cashu.rpc_key');
		const rpc_cert = this.configService.get('cashu.rpc_cert');
		const rpc_mtls = this.configService.get('cashu.rpc_mtls');
		const rpc_ca = this.configService.get('cashu.rpc_ca');
		const rpc_host = this.configService.get('cashu.rpc_host');
		const rpc_port = this.configService.get('cashu.rpc_port');
		const rpc_url = `${rpc_host}:${rpc_port}`;

		if (!rpc_host || !rpc_port) {
			this.logger.warn('Missing RPC host or port, connection cannot be established');
			return;
		}

		try {
			const proto_path = path.join(process.cwd(), 'proto/cdk/cdk-mint-rpc.proto');
			const package_definition = protoLoader.loadSync(proto_path, {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			});
			const mint_proto: any = grpc.loadPackageDefinition(package_definition).cdk_mint_management_v1;
			let credentials: grpc.ChannelCredentials;
			let channel_options: Record<string, any> | undefined = undefined;

			if (rpc_mtls) {
				const key_content = this.credentialService.loadPemOrPath(rpc_key);
				const cert_content = this.credentialService.loadPemOrPath(rpc_cert);
				const ca_content = this.credentialService.loadPemOrPath(rpc_ca);

				if (!key_content || !cert_content || !ca_content) {
					const missing = [!ca_content && 'CA certificate', !cert_content && 'client certificate', !key_content && 'client key']
						.filter(Boolean)
						.join(', ');
					this.logger.error(
						`Failed to load CDK mTLS credential(s): ${missing} — check that the file paths exist and are readable`,
					);
					return undefined;
				}

				credentials = grpc.credentials.createSsl(ca_content, key_content, cert_content);
				if (rpc_host?.includes('host.docker.internal')) {
					channel_options = {
						'grpc.ssl_target_name_override': 'localhost',
						'grpc.default_authority': 'localhost',
					};
				}
				this.logger.log('Mint gRPC client initialized with TLS certificate authentication');
			} else {
				credentials = grpc.credentials.createInsecure();
				this.logger.log('Mint gRPC client initialized with INSECURE connection');
			}

			return new mint_proto.CdkMint(rpc_url, credentials, channel_options);
		} catch (error) {
			this.logger.error(`Failed to initialize gRPC client: ${error.message}`);
		}
	}

	public async getBalances(client: CashuMintDatabase, keyset_id?: string): Promise<CashuMintBalance[]> {
		const where_clause = keyset_id ? 'WHERE ka.keyset_id = ?' : '';
		const sql = `
			SELECT
				ka.keyset_id AS keyset,
				ka.total_issued - ka.total_redeemed AS balance,
				k.unit
			FROM keyset_amounts ka
			LEFT JOIN keyset k ON k.id = ka.keyset_id
			${where_clause}
			ORDER BY keyset;
		`;

		const params = keyset_id ? [keyset_id] : [];
		try {
			return queryRows<CashuMintBalance>(client, sql, params);
		} catch (err) {
			throw err;
		}
	}

	public async getBalancesIssued(client: CashuMintDatabase): Promise<CashuMintBalance[]> {
		const sql = `
			SELECT keyset_id AS keyset, total_issued AS balance
			FROM keyset_amounts
			ORDER BY keyset_id;`;
		try {
			return queryRows<CashuMintBalance>(client, sql);
		} catch (err) {
			throw err;
		}
	}

	public async getBalancesRedeemed(client: CashuMintDatabase): Promise<CashuMintBalance[]> {
		const sql = `
			SELECT keyset_id AS keyset, total_redeemed AS balance
			FROM keyset_amounts
			ORDER BY keyset_id;`;
		try {
			return queryRows<CashuMintBalance>(client, sql);
		} catch (err) {
			throw err;
		}
	}

	public async getKeysets(client: CashuMintDatabase): Promise<CashuMintKeyset[]> {
		const sql = `
            SELECT *, NULLIF(valid_to, 0) AS final_expiry, CAST(COALESCE(fee_collected, 0) AS INTEGER) AS fees_paid FROM keyset
            LEFT JOIN keyset_amounts ON keyset_amounts.keyset_id = keyset.id
            WHERE unit != ?;
            `;
		try {
			return queryRows<CashuMintKeyset>(client, sql, ['auth']);
		} catch (err) {
			throw err;
		}
	}

	public async listMintQuotes(client: CashuMintDatabase, args?: CashuMintMintQuotesArgs): Promise<CashuMintMintQuote[]> {
		const field_mappings = {
			units: 'unit',
			date_start: 'created_time',
			date_end: 'created_time',
			states: 'state',
		};

		const state_case = `
			CASE
				WHEN amount_paid = 0 AND amount_issued = 0 THEN 'UNPAID'
				WHEN amount_paid > amount_issued THEN 'PAID'
				ELSE 'ISSUED'
			END
		`;

		const issued_time_expr = `
			CASE
				WHEN EXISTS (SELECT 1 FROM mint_quote_issued i WHERE i.quote_id = mint_quote.id)
					THEN (SELECT MIN(timestamp) FROM mint_quote_issued i WHERE i.quote_id = mint_quote.id)
				WHEN amount_paid = 0 AND amount_issued = 0 THEN NULL
				WHEN amount_paid > amount_issued THEN NULL
				ELSE created_time
			END
		`;
		const paid_time_expr = `
			CASE
				WHEN EXISTS (SELECT 1 FROM mint_quote_payments p WHERE p.quote_id = mint_quote.id)
					THEN (SELECT MIN(timestamp) FROM mint_quote_payments p WHERE p.quote_id = mint_quote.id)
				WHEN amount_paid = 0 THEN NULL
				WHEN amount_paid > amount_issued THEN created_time
				WHEN amount_paid = amount_issued THEN created_time
				ELSE NULL
			END
		`;

		const select_statement = `
			SELECT *
			FROM (
				SELECT 
					id, amount, unit, request, request_lookup_id, pubkey, created_time, amount_paid, amount_issued,
					lower(payment_method) AS payment_method,
					${issued_time_expr} AS issued_time,
					${paid_time_expr} AS paid_time,
					${state_case} AS state
				FROM mint_quote
			) mq`;

		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'mint_quote',
			args,
			field_mappings,
			select_statement,
			time_is_epoch_seconds: true,
		});
		try {
			const rows = await queryRows<CashuMintMintQuote>(client, sql, params);
			return rows.map((row) => ({
				...row,
				created_time: convertDateToUnixTimestamp(row.created_time),
				issued_time: row.issued_time != null ? convertDateToUnixTimestamp(row.issued_time) : null,
				paid_time: row.paid_time != null ? convertDateToUnixTimestamp(row.paid_time) : null,
			}));
		} catch (err) {
			throw err;
		}
	}

	public async lookupMintQuote(client: CashuMintDatabase, quote_id: string): Promise<CashuMintMintQuote | null> {
		const state_case = `
			CASE
				WHEN amount_paid = 0 AND amount_issued = 0 THEN 'UNPAID'
				WHEN amount_paid > amount_issued THEN 'PAID'
				ELSE 'ISSUED'
			END
		`;
		const sql = `
			SELECT id, amount, unit, request, request_lookup_id, pubkey, created_time,
				amount_paid, amount_issued, lower(payment_method) AS payment_method,
				${state_case} AS state
			FROM mint_quote WHERE id = ?`;
		try {
			const row = await queryRow<CashuMintMintQuote | undefined>(client, sql, [quote_id]);
			if (!row) return null;
			return {...row, created_time: convertDateToUnixTimestamp(row.created_time)};
		} catch (err) {
			throw err;
		}
	}

	public async lookupMeltQuote(client: CashuMintDatabase, quote_id: string): Promise<CashuMintMeltQuote | null> {
		const sql = `SELECT * FROM melt_quote WHERE id = ?`;
		try {
			const row = await queryRow<CashuMintMeltQuote | undefined>(client, sql, [quote_id]);
			if (!row) return null;
			return {
				...row,
				created_time: convertDateToUnixTimestamp(row.created_time),
				paid_time: row.paid_time != null ? convertDateToUnixTimestamp(row.paid_time) : null,
			};
		} catch (err) {
			throw err;
		}
	}

	public async listMeltQuotes(client: CashuMintDatabase, args?: CashuMintMeltQuotesArgs): Promise<CashuMintMeltQuote[]> {
		const field_mappings = {
			units: 'unit',
			date_start: 'created_time',
			date_end: 'created_time',
			states: 'state',
		};
		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'melt_quote',
			args,
			field_mappings,
			time_is_epoch_seconds: true,
		});
		try {
			const rows = await queryRows<CashuMintMeltQuote>(client, sql, params);
			return rows.map((row) => {
				const s = extractRequestString(row.request);
				return {
					...row,
					request: s || row.request,
					created_time: convertDateToUnixTimestamp(row.created_time),
					paid_time: row.paid_time != null ? convertDateToUnixTimestamp(row.paid_time) : null,
				};
			});
		} catch (err) {
			throw err;
		}
	}

	public async listProofGroups(client: CashuMintDatabase, args?: CashuMintProofsArgs): Promise<CashuMintProofGroup[]> {
		const field_mappings = {
			states: 'p.state',
			units: 'k.unit',
			id_keysets: 'p.keyset_id',
			date_start: 'p.created_time',
			date_end: 'p.created_time',
		};

		const select_statement = `
			SELECT 
				p.created_time,
				p.keyset_id,
				k.unit,
				p.state,
				json_group_array(p.amount) as amounts
			FROM proof p
			LEFT JOIN keyset k ON k.id = p.keyset_id`;

		const group_by = 'p.created_time, k.unit, p.state, p.keyset_id';
		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'proof',
			args,
			field_mappings,
			select_statement,
			group_by,
			time_is_epoch_seconds: true,
		});
		try {
			const rows = await queryRows<CdkMintProof>(client, sql, params);
			const groups = {};
			rows.forEach((row) => {
				const key = `${row.created_time}_${row.unit}_${row.state}`;
				const amounts = Array.isArray(row.amounts) ? row.amounts : JSON.parse(row.amounts);
				if (!groups[key]) {
					groups[key] = {
						created_time: row.created_time,
						unit: row.unit,
						state: row.state,
						keysets: [],
						amounts: [],
					};
				}
				groups[key].keysets.push(row.keyset_id);
				groups[key].amounts.push(amounts);
			});

			const proof_groups: CashuMintProofGroup[] = Object.values(groups).map((group: any) => ({
				amount: group.amounts.flat().reduce((sum: number, amount: number) => sum + amount, 0),
				created_time: convertDateToUnixTimestamp(group.created_time),
				keyset_ids: group.keysets,
				unit: group.unit,
				state: group.state,
				amounts: group.amounts,
			}));
			return proof_groups;
		} catch (err) {
			throw err;
		}
	}

	public async listProofs(client: CashuMintDatabase, args?: CashuMintProofsArgs): Promise<CashuMintProof[]> {
		const field_mappings = {
			states: 'p.state',
			units: 'k.unit',
			id_keysets: 'p.keyset_id',
			date_start: 'p.created_time',
			date_end: 'p.created_time',
		};

		const select_statement = `
			SELECT
				p.amount,
				p.keyset_id,
				k.unit,
				p.state,
				p.created_time
			FROM proof p
			LEFT JOIN keyset k ON k.id = p.keyset_id`;

		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'proof',
			args,
			field_mappings,
			select_statement,
			time_is_epoch_seconds: true,
		});
		const rows = await queryRows<CashuMintProof>(client, sql, params);
		return rows.map((row) => ({...row, created_time: convertDateToUnixTimestamp(row.created_time)}));
	}

	public async listPromises(client: CashuMintDatabase, args?: CashuMintPromiseArgs): Promise<CashuMintPromise[]> {
		const field_mappings = {
			units: 'k.unit',
			id_keysets: 'bs.keyset_id',
			date_start: 'bs.created_time',
			date_end: 'bs.created_time',
		};

		const select_statement = `
			SELECT
				bs.amount,
				bs.keyset_id,
				k.unit,
				bs.created_time
			FROM blind_signature bs
			LEFT JOIN keyset k ON k.id = bs.keyset_id`;

		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'blind_signature',
			args,
			field_mappings,
			select_statement,
			time_is_epoch_seconds: true,
		});
		const rows = await queryRows<CashuMintPromise>(client, sql, params);
		return rows.map((row) => ({...row, created_time: convertDateToUnixTimestamp(row.created_time)}));
	}

	public async countMintQuotes(client: CashuMintDatabase, args?: CashuMintMintQuotesArgs): Promise<number> {
		const field_mappings = {
			units: 'unit',
			date_start: 'created_time',
			date_end: 'created_time',
			states: 'state',
		};

		const state_case = `
			CASE
				WHEN amount_paid = 0 AND amount_issued = 0 THEN 'UNPAID'
				WHEN amount_paid > amount_issued THEN 'PAID'
				ELSE 'ISSUED'
			END
		`;

		const select_statement = `
			SELECT COUNT(*) AS count FROM (
				SELECT 
					created_time,
					unit,
					${state_case} AS state
				FROM mint_quote
			) subquery`;

		const {sql, params} = buildCountQuery({
			db_type: client.type,
			table_name: 'mint_quote',
			args,
			field_mappings,
			select_statement,
			time_is_epoch_seconds: true,
		});
		try {
			const row = await queryRow<CashuMintCount>(client, sql, params);
			return row.count;
		} catch (err) {
			throw err;
		}
	}

	public async countMeltQuotes(client: CashuMintDatabase, args?: CashuMintMeltQuotesArgs): Promise<number> {
		const field_mappings = {
			units: 'unit',
			date_start: 'created_time',
			date_end: 'created_time',
			states: 'state',
		};
		const {sql, params} = buildCountQuery({
			db_type: client.type,
			table_name: 'melt_quote',
			args,
			field_mappings,
			time_is_epoch_seconds: true,
		});
		try {
			const row = await queryRow<CashuMintCount>(client, sql, params);
			return row.count;
		} catch (err) {
			throw err;
		}
	}

	public async countSwaps(client: CashuMintDatabase, args?: CashuMintSwapsArgs): Promise<number> {
		const swap_args = {...args, operation_kind: 'swap'};
		const field_mappings = {
			units: 'k.unit',
			id_keysets: 'bs.keyset_id',
			date_start: 'co.completed_at',
			date_end: 'co.completed_at',
			operation_kind: 'co.operation_kind',
		};

		const select_statement = `
			SELECT COUNT(*) AS count
			FROM completed_operations co
			LEFT JOIN (
				SELECT operation_id, MIN(keyset_id) AS keyset_id FROM blind_signature GROUP BY operation_id
			) bs ON bs.operation_id = co.operation_id
			LEFT JOIN keyset k ON k.id = bs.keyset_id`;

		const {sql, params} = buildCountQuery({
			db_type: client.type,
			table_name: 'completed_operations',
			args: swap_args,
			field_mappings,
			select_statement,
			time_is_epoch_seconds: true,
		});
		try {
			const row = await queryRow<CashuMintCount>(client, sql, params);
			return row.count;
		} catch (err) {
			throw err;
		}
	}

	/** Per-op fee rows. The op→proof→keyset fan-out is collapsed by GROUP BY (op × unit); safe
	 *  because Cashu spec requires every proof in one op to share a unit. group_by lists all
	 *  non-aggregated columns since Postgres can't infer PK FD through the derived `co` subquery. */
	public async listFees(client: CashuMintDatabase, args?: CashuMintFeesArgs): Promise<CashuMintOperationFee[]> {
		const field_mappings = {
			units: 'k.unit',
			date_start: 'co.completed_at',
			date_end: 'co.completed_at',
		};

		const select_statement = `
			SELECT
				k.unit AS unit,
				co.completed_at AS created_time,
				co.fee_collected AS fee
			FROM (SELECT * FROM completed_operations WHERE fee_collected > 0) co
			INNER JOIN proof p ON p.operation_id = co.operation_id
			INNER JOIN keyset k ON k.id = p.keyset_id`;
		const group_by = 'co.operation_id, co.completed_at, co.fee_collected, k.unit';
		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'completed_operations',
			args,
			field_mappings,
			select_statement,
			group_by,
			time_is_epoch_seconds: true,
		});
		try {
			const rows = await queryRows<CashuMintOperationFee>(client, sql, params);
			return rows.map((row) => ({
				...row,
				created_time: convertDateToUnixTimestamp(row.created_time) ?? row.created_time,
			}));
		} catch (err) {
			throw err;
		}
	}

	public async listSwaps(client: CashuMintDatabase, args?: CashuMintSwapsArgs): Promise<CashuMintSwap[]> {
		const swap_args = {...args, operation_kind: 'swap'};
		const field_mappings = {
			units: 'k.unit',
			id_keysets: 'bs.keyset_id',
			date_start: 'co.completed_at',
			date_end: 'co.completed_at',
			operation_kind: 'co.operation_kind',
		};

		const concat_keyset_ids =
			client.type === MintDatabaseType.postgres ? `STRING_AGG(DISTINCT bs.keyset_id, ',')` : `GROUP_CONCAT(DISTINCT bs.keyset_id)`;

		const select_statement = `
			SELECT
				co.operation_id,
				${concat_keyset_ids} AS keyset_ids,
				k.unit,
				co.total_redeemed AS amount,
				co.completed_at AS created_time,
				co.fee_collected AS fee
			FROM completed_operations co
			LEFT JOIN blind_signature bs ON bs.operation_id = co.operation_id
			LEFT JOIN keyset k ON k.id = bs.keyset_id`;

		const group_by = 'co.operation_id, k.unit';
		const {sql, params} = buildDynamicQuery({
			db_type: client.type,
			table_name: 'completed_operations',
			args: swap_args,
			field_mappings,
			select_statement,
			group_by,
			time_is_epoch_seconds: true,
		});
		try {
			const rows = await queryRows<CashuMintSwap & {keyset_ids: string}>(client, sql, params);
			return rows.map((row) => ({
				...row,
				keyset_ids: row.keyset_ids ? row.keyset_ids.split(',') : [],
				created_time: convertDateToUnixTimestamp(row.created_time),
			}));
		} catch (err) {
			throw err;
		}
	}
}
