/* Native Dependencies */
import {MintUnit, MintQuoteState, MeltQuoteState, MintProofState} from '@server/modules/cashu/cashu.enums';

export interface CashuMintMintQuotesArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	states?: MintQuoteState[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintMeltQuotesArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	states?: MeltQuoteState[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintSwapsArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintPromiseArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintProofsArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	states?: MintProofState[];
	id_keysets?: string[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}

export interface CashuMintFeesArgs {
	date_start?: number;
	date_end?: number;
	units?: MintUnit[];
	page?: number;
	page_size?: number;
	sort_order?: 'ASC' | 'DESC';
}
