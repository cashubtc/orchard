/* Native Dependencies */
import {MintQuoteState, MeltQuoteState} from '#server/modules/cashu/cashu.enums';

export type NutshellMintMintQuote = {
	quote: string;
	request: string;
	checking_id: string;
	unit: string;
	amount: number;
	created_time: number;
	paid_time: number;
	state: MintQuoteState;
	pubkey: string;
};

export type NutshellMintMeltQuote = {
	quote: string;
	method: string;
	request: string;
	checking_id: string;
	unit: string;
	amount: number;
	fee_reserve: number;
	paid: number;
	created_time: number;
	paid_time: number;
	fee_paid: number;
	proof: string;
	state: MeltQuoteState;
	change: string;
	expiry: number;
	outputs: string;
};

export type NutshellMintEcash = {
	created: number;
	id: string;
	unit: string;
	amounts: string;
};
