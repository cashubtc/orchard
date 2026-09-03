/* Native Dependencies */
import {MintQuoteState, MeltQuoteState, MintProofState} from '#server/modules/cashu/cashu.enums';

export interface CashuMintMintQuotesArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	states?: MintQuoteState[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintMeltQuotesArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	states?: MeltQuoteState[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintSwapsArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintPromiseArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintProofsArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	states?: MintProofState[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintFeesArgs {
	date_start?: number;
	date_end?: number;
	units?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}
