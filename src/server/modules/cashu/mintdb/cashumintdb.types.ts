/* Vendor Dependencies */
import type {Database} from 'better-sqlite3';
import {Client} from 'pg';
/* Native Dependencies */
import {MintQuoteState, MeltQuoteState, MintProofState} from '#server/modules/cashu/cashu.enums';
/* Local Dependencies */
import {MintDatabaseType} from '#server/modules/cashu/mintdb/cashumintdb.enums';

export type CashuMintDatabase = CashuMintSqliteDatabase | CashuMintPostgresDatabase;
type CashuMintSqliteDatabase = {
	type: MintDatabaseType.sqlite;
	database: Database;
};
type CashuMintPostgresDatabase = {
	type: MintDatabaseType.postgres;
	database: InstanceType<typeof Client>;
};

export type CashuMintBalance = {
	keyset: string;
	balance: number;
	unit: string;
};

export type CashuMintKeyset = {
	id: string;
	derivation_path: string;
	derivation_path_index: number;
	valid_from: number;
	valid_to: number | null;
	final_expiry: number | null;
	active: number;
	unit: string;
	input_fee_ppk: number | null;
	fees_paid: number | null;
	amounts: number[];
};

export type CashuMintMintQuote = {
	id: string;
	amount: number | null;
	unit: string;
	request: string;
	state: MintQuoteState;
	request_lookup_id: string | null;
	pubkey: string | null;
	created_time: number;
	issued_time: number | null;
	paid_time: number | null;
	amount_paid: number;
	amount_issued: number;
	payment_method: string;
};

export type CashuMintMeltQuote = {
	id: string;
	unit: string;
	amount: number;
	request: string;
	fee_reserve: number;
	state: MeltQuoteState;
	payment_preimage: string | null;
	request_lookup_id: string | null;
	msat_to_pay: number | null;
	created_time: number;
	paid_time: number | null;
	payment_method: string;
};

export type CashuMintSwap = {
	operation_id: string | null;
	keyset_ids: string[];
	unit: string;
	amount: number;
	created_time: number;
	fee: number | null;
};

export type CashuMintOperationFee = {
	unit: string;
	created_time: number;
	fee: number;
};

export type CashuMintProofGroup = {
	amount: number;
	created_time: number;
	keyset_ids: string[];
	unit: string;
	state: MintProofState;
	amounts: number[][];
};

export type CashuMintCount = {
	count: number;
};

export type CashuMintProof = {
	amount: number;
	keyset_id: string;
	unit: string;
	state: MintProofState;
	created_time: number;
};

export type CashuMintPromise = {
	amount: number;
	keyset_id: string;
	unit: string;
	created_time: number;
};

export type CashuMintDatabaseInfo = {
	size: number;
	type: string;
};
