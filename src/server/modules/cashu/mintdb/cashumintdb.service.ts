/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
import {promises as fs} from 'fs';
/* Vendor Dependencies */
import {Client} from 'pg';
import DatabaseConstructor from 'better-sqlite3';
import {spawn} from 'child_process';
/* Application Dependencies */
import {MintType} from '@server/modules/cashu/cashu.enums';
import {CredentialService} from '@server/modules/credential/credential.service';
import {NutshellService} from '@server/modules/cashu/nutshell/nutshell.service';
import {CdkService} from '@server/modules/cashu/cdk/cdk.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
/* Local Dependencies */
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
	CashuMintOperationFee,
	CashuMintDatabaseInfo,
} from './cashumintdb.types';
import {
	CashuMintMintQuotesArgs,
	CashuMintProofsArgs,
	CashuMintPromiseArgs,
	CashuMintMeltQuotesArgs,
	CashuMintSwapsArgs,
	CashuMintFeesArgs,
} from './cashumintdb.interfaces';
import {MintDatabaseType} from './cashumintdb.enums';

@Injectable()
export class CashuMintDatabaseService implements OnModuleInit {
	private readonly logger = new Logger(CashuMintDatabaseService.name);
	private type: MintType;
	private database: string;

	constructor(
		private configService: ConfigService,
		private credentialService: CredentialService,
		private nutshellService: NutshellService,
		private cdkService: CdkService,
	) {}

	public async onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.type = this.configService.get('cashu.type');
		this.database = this.configService.get('cashu.database');
	}

	public async getMintDatabase(): Promise<CashuMintDatabase> {
		try {
			if (this.configService.get('cashu.database_type') === 'sqlite') {
				return this.createSqliteDatabase();
			} else {
				return this.createPostgresDatabase();
			}
		} catch (error) {
			this.logger.debug(error);
			throw OrchardErrorCode.MintDatabaseConnectionError;
		}
	}

	private createSqliteDatabase(): CashuMintDatabase {
		const db = new DatabaseConstructor(this.database, {readonly: true, fileMustExist: true});
		try {
			db.pragma('busy_timeout = 5000');
		} catch {}
		return {type: MintDatabaseType.sqlite, database: db};
	}

	private createPostgresDatabase(): CashuMintDatabase {
		const ssl_config = this.getPostgresSslConfig(this.database);
		const connection_string = this.cleanConnectionString(this.database, ssl_config);
		const client = new Client({
			connectionString: connection_string,
			ssl: ssl_config,
		});
		return {type: MintDatabaseType.postgres, database: client};
	}

	private cleanConnectionString(connection_string: string, ssl_config: any): string {
		if (ssl_config === undefined) return connection_string;
		return connection_string
			.replace(/[?&]sslmode=[^&]*/gi, '')
			.replace(/[?]&/, '?') // Fix if sslmode was first param: ?sslmode=x&foo=bar -> ?foo=bar
			.replace(/[?]$/, ''); // Remove trailing ? if sslmode was only param
	}

	private getVerifiedSslConfig(): Record<string, any> | true {
		const ca_cert = this.configService.get('cashu.database_ca');
		const client_cert = this.configService.get('cashu.database_cert');
		const client_key = this.configService.get('cashu.database_key');

		if (!ca_cert) {
			this.logger.warn(
				'SSL verification requested but MINT_DATABASE_CA not provided. ' +
					'Connection will likely fail. Use sslmode=require for self-signed certs.',
			);
			return true; // Will fail, but let pg library handle the error
		}

		const ca_content = this.credentialService.loadPemOrPath(ca_cert);
		const ssl_config: any = {
			rejectUnauthorized: true,
			ca: ca_content,
		};
		if (client_cert && client_key) {
			ssl_config.cert = this.credentialService.loadPemOrPath(client_cert);
			ssl_config.key = this.credentialService.loadPemOrPath(client_key);
		}
		return ssl_config;
	}

	private getPostgresSslConfig(connection_string: string): any {
		if (!connection_string.includes('ssl')) return undefined;
		const sslmode_match = connection_string.match(/sslmode=([^&]+)/i);
		const sslmode = sslmode_match ? sslmode_match[1].toLowerCase() : null;
		switch (sslmode) {
			case 'disable':
				return undefined;
			case 'allow':
			case 'prefer':
			case 'require':
				return {rejectUnauthorized: false};
			case 'verify-ca':
			case 'verify-full':
				return this.getVerifiedSslConfig();
			default:
				return {rejectUnauthorized: false};
		}
	}

	public async getBalances(client: CashuMintDatabase, keyset_id?: string): Promise<CashuMintBalance[]> {
		if (this.type === 'nutshell') return this.nutshellService.getBalances(client, keyset_id);
		if (this.type === 'cdk') return this.cdkService.getBalances(client, keyset_id);
	}

	public async getBalancesIssued(client: CashuMintDatabase): Promise<CashuMintBalance[]> {
		if (this.type === 'nutshell') return this.nutshellService.getBalancesIssued(client);
		if (this.type === 'cdk') return this.cdkService.getBalancesIssued(client);
	}

	public async getBalancesRedeemed(client: CashuMintDatabase): Promise<CashuMintBalance[]> {
		if (this.type === 'nutshell') return this.nutshellService.getBalancesRedeemed(client);
		if (this.type === 'cdk') return this.cdkService.getBalancesRedeemed(client);
	}

	public async getKeysets(client: CashuMintDatabase): Promise<CashuMintKeyset[]> {
		if (this.type === 'nutshell') return this.nutshellService.getKeysets(client);
		if (this.type === 'cdk') return this.cdkService.getKeysets(client);
	}

	public async getWatchdogLastSeen(client: CashuMintDatabase): Promise<number | null> {
		if (this.type === 'nutshell') return this.nutshellService.getWatchdogLastSeen(client);
		if (this.type === 'cdk') throw OrchardErrorCode.MintSupportError;
	}

	public async listMintQuotes(client: CashuMintDatabase, args?: CashuMintMintQuotesArgs): Promise<CashuMintMintQuote[]> {
		if (this.type === 'nutshell') return this.nutshellService.listMintQuotes(client, args);
		if (this.type === 'cdk') return this.cdkService.listMintQuotes(client, args);
	}

	public async lookupMintQuote(client: CashuMintDatabase, quote_id: string): Promise<CashuMintMintQuote | null> {
		if (this.type === 'nutshell') return this.nutshellService.lookupMintQuote(client, quote_id);
		if (this.type === 'cdk') return this.cdkService.lookupMintQuote(client, quote_id);
	}

	public async listMeltQuotes(client: CashuMintDatabase, args?: CashuMintMeltQuotesArgs): Promise<CashuMintMeltQuote[]> {
		if (this.type === 'nutshell') return this.nutshellService.listMeltQuotes(client, args);
		if (this.type === 'cdk') return this.cdkService.listMeltQuotes(client, args);
	}

	public async lookupMeltQuote(client: CashuMintDatabase, quote_id: string): Promise<CashuMintMeltQuote | null> {
		if (this.type === 'nutshell') return this.nutshellService.lookupMeltQuote(client, quote_id);
		if (this.type === 'cdk') return this.cdkService.lookupMeltQuote(client, quote_id);
	}

	public async listSwaps(client: CashuMintDatabase, args?: CashuMintSwapsArgs): Promise<CashuMintSwap[]> {
		if (this.type === 'nutshell') return this.nutshellService.listSwaps(client, args);
		if (this.type === 'cdk') return this.cdkService.listSwaps(client, args);
	}

	public async listFees(client: CashuMintDatabase, args?: CashuMintFeesArgs): Promise<CashuMintOperationFee[]> {
		if (this.type === 'nutshell') return this.nutshellService.listFees(client, args);
		if (this.type === 'cdk') return this.cdkService.listFees(client, args);
	}

	public async listProofGroups(client: CashuMintDatabase, args?: CashuMintProofsArgs): Promise<CashuMintProofGroup[]> {
		if (this.type === 'nutshell') return this.nutshellService.listProofGroups(client, args);
		if (this.type === 'cdk') return this.cdkService.listProofGroups(client, args);
	}

	public async listProofs(client: CashuMintDatabase, args?: CashuMintProofsArgs): Promise<CashuMintProof[]> {
		if (this.type === 'nutshell') return this.nutshellService.listProofs(client, args);
		if (this.type === 'cdk') return this.cdkService.listProofs(client, args);
	}

	public async listPromises(client: CashuMintDatabase, args?: CashuMintPromiseArgs): Promise<CashuMintPromise[]> {
		if (this.type === 'nutshell') return this.nutshellService.listPromises(client, args);
		if (this.type === 'cdk') return this.cdkService.listPromises(client, args);
	}

	public async countMintQuotes(client: CashuMintDatabase, args?: CashuMintMintQuotesArgs): Promise<number> {
		if (this.type === 'nutshell') return this.nutshellService.countMintQuotes(client, args);
		if (this.type === 'cdk') return this.cdkService.countMintQuotes(client, args);
	}

	public async countMeltQuotes(client: CashuMintDatabase, args?: CashuMintMeltQuotesArgs): Promise<number> {
		if (this.type === 'nutshell') return this.nutshellService.countMeltQuotes(client, args);
		if (this.type === 'cdk') return this.cdkService.countMeltQuotes(client, args);
	}

	public async countSwaps(client: CashuMintDatabase, args?: CashuMintSwapsArgs): Promise<number> {
		if (this.type === 'nutshell') return this.nutshellService.countSwaps(client, args);
		if (this.type === 'cdk') return this.cdkService.countSwaps(client, args);
	}

	/* Implementation Agnostic */

	/** Returns the size and type of the mint database. */
	public async getDatabaseInfo(client: CashuMintDatabase): Promise<CashuMintDatabaseInfo> {
		if (client.type === MintDatabaseType.sqlite) {
			const stat = await fs.stat(this.database);
			return {size: stat.size, type: 'sqlite'};
		}
		const result = await client.database.query('SELECT pg_database_size(current_database()) AS size;');
		return {size: Number(result.rows[0].size), type: 'postgres'};
	}

	public async createBackup(client: CashuMintDatabase): Promise<Buffer> {
		if (client.type === MintDatabaseType.sqlite) return this.createBackupSqlite(client);
		if (client.type === MintDatabaseType.postgres) return this.createBackupPostgres();
	}

	public async restoreBackup(filebase64: string): Promise<void> {
		if (this.configService.get('cashu.database_type') === 'sqlite') return this.restoreBackupSqlite(filebase64);
		if (this.configService.get('cashu.database_type') === 'postgres') return this.restoreBackupPostgres(filebase64);
	}

	private async createBackupSqlite(client: CashuMintDatabase): Promise<Buffer> {
		const backup_path = path.resolve('data/tmp/sqlite-backup.db');
		try {
			await client.database.backup(backup_path);
			const file_buffer = await fs.readFile(backup_path);
			await fs.unlink(backup_path);
			return file_buffer;
		} catch (error) {
			this.logger.error(`Error during database backup: ${error.message}`);
			try {
				await fs.unlink(backup_path);
			} catch {}
			throw error;
		}
	}

	private async restoreBackupSqlite(filebase64: string): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const database_buffer: Buffer = Buffer.from(filebase64, 'base64');
			const restore_path = path.resolve('data/tmp/sqlite-restore.db');

			try {
				await fs.writeFile(restore_path, database_buffer);
				const is_valid_sqlite = await this.validateSqliteFile(restore_path);
				if (!is_valid_sqlite) {
					this.logger.error('Invalid file: Not a valid SQLite database');
					await fs.unlink(restore_path);
					reject(OrchardErrorCode.MintDatabaseRestoreInvalidError);
					return;
				}
				await fs.unlink(this.database);
				fs.copyFile(restore_path, this.database)
					.then(async () => {
						try {
							await fs.unlink(restore_path);
						} catch (error) {
							this.logger.warn(`Warning: Could not clean up temporary file: ${error.message}`);
						}
						this.logger.log('Database backup restored successfully');
						resolve();
					})
					.catch(async (copy_error) => {
						this.logger.error(`Error restoring database: ${copy_error.message}`);
						try {
							await fs.unlink(restore_path);
						} catch {}
						reject(copy_error);
					});
			} catch (write_error) {
				this.logger.error(`Error writing backup file: ${write_error.message}`);
				reject(write_error);
			}
		});
	}

	private async createBackupPostgres(): Promise<Buffer> {
		const backup_path = path.resolve('data/tmp/postgres-backup.sql');
		try {
			const connection_string = this.configService.get('cashu.database');
			const {host, port, username, password, db_name} = this.parsePostgresConnection(connection_string);
			const env = {...process.env, PGPASSWORD: password};
			const args = [
				`--host=${host}`,
				`--port=${port}`,
				`--username=${username}`,
				`--dbname=${db_name}`,
				`--clean`,
				`--if-exists`,
				`--file=${backup_path}`,
			];

			await new Promise<void>((resolve, reject) => {
				const pg_dump_process = spawn(`pg_dump`, args, {
					env,
					stdio: ['ignore', 'pipe', 'inherit'],
				});
				pg_dump_process.on('close', (code) => {
					if (code === 0) resolve();
					else reject(OrchardErrorCode.MintDatabaseBackupError);
				});
				pg_dump_process.on('error', (error) => {
					reject(error);
				});
			});

			const file_buffer = await fs.readFile(backup_path);
			await fs.unlink(backup_path);
			return file_buffer;
		} catch (error) {
			this.logger.error(`Error during database backup: ${error}`);
			try {
				await fs.unlink(backup_path);
			} catch {}
			throw OrchardErrorCode.MintDatabaseBackupError;
		}
	}

	private async restoreBackupPostgres(filebase64: string): Promise<void> {
		const restore_path = path.resolve('data/tmp/postgres-restore.sql');
		try {
			const database_buffer: Buffer = Buffer.from(filebase64, 'base64');
			await fs.writeFile(restore_path, database_buffer);
			const connection_string = this.configService.get('cashu.database');
			const {host, port, username, password, db_name} = this.parsePostgresConnection(connection_string);
			const env = {...process.env, PGPASSWORD: password};
			const args = [`--host=${host}`, `--port=${port}`, `--username=${username}`, `--dbname=${db_name}`, `--file=${restore_path}`];
			await new Promise<void>((resolve, reject) => {
				const psql_process = spawn(`psql`, args, {
					env,
					stdio: ['ignore', 'pipe', 'inherit'],
				});
				psql_process.on('close', (code) => {
					if (code === 0) resolve();
					else reject(OrchardErrorCode.MintDatabaseRestoreError);
				});
				psql_process.on('error', (error) => {
					reject(error);
				});
			});

			await fs.unlink(restore_path);
			this.logger.log('PostgreSQL database backup restored successfully');
		} catch (error) {
			this.logger.error(`Error restoring PostgreSQL database: ${error}`);
			try {
				await fs.unlink(restore_path);
			} catch {}
			throw OrchardErrorCode.MintDatabaseRestoreError;
		}
	}

	private parsePostgresConnection(connection_string: string): {
		host: string;
		port: string;
		username: string;
		password: string;
		db_name: string;
	} {
		const url = new URL(connection_string);
		return {
			host: url.hostname,
			port: url.port || '5432',
			username: url.username,
			password: url.password,
			db_name: url.pathname.slice(1),
		};
	}

	private async validateSqliteFile(file_path: string): Promise<boolean> {
		try {
			const file_handle = await fs.open(file_path, 'r');
			const buffer = Buffer.alloc(16);
			await file_handle.read(buffer, 0, 16, 0);
			await file_handle.close();
			const sqlite_header = Buffer.from('SQLite format 3\0');
			if (!buffer.equals(sqlite_header)) return false;
			const test_db = new DatabaseConstructor(file_path);
			const row = await test_db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").get();
			test_db.close();
			return row !== undefined;
		} catch (error) {
			this.logger.error(`Error validating SQLite file: ${error.message}`);
			return false;
		}
	}
}
