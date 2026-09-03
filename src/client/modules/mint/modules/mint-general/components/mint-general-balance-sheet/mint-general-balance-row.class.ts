/* Application Dependencies */
import {toDisplayAmount} from '@client/modules/local/helpers/unit.helpers';
import {oracleConvertToUSDCents, eligibleForOracleConversion} from '@client/modules/bitcoin/helpers/oracle.helpers';
/* Native Dependencies */
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';

export class MintGeneralBalanceRow {
	is_bitcoin: boolean;
	unit_lightning: string;
	unit_mint: string;
	liabilities: number;
	liabilities_oracle: number | null;
	input_fee_ppk: number;
	active: boolean;
	derivation_path_index: number;
	first_seen: number | null;
	assets: number | null;
	assets_oracle: number | null;
	fees: number | null;
	fees_oracle: number | null;

	public get reserve(): number | null {
		if (this.assets === null) return null;
		const liabilities = toDisplayAmount(this.unit_mint, this.liabilities);
		if (liabilities === 0) return null;
		const multiple = Math.ceil(this.assets) / liabilities;
		if (multiple < 5) return Math.round(multiple * 10) / 10;
		return Math.round(multiple);
	}

	constructor(balance: MintBalance | undefined, assets: number | null, keyset: MintKeyset, oracle_price: number | null) {
		this.unit_lightning = 'sat';
		this.unit_mint = keyset.unit;
		this.is_bitcoin = eligibleForOracleConversion(this.unit_mint);
		this.liabilities = balance?.balance ?? 0;
		this.liabilities_oracle = oracleConvertToUSDCents(this.liabilities, oracle_price, this.unit_mint);
		this.fees = keyset.fees_paid ?? null;
		this.fees_oracle = oracleConvertToUSDCents(this.fees, oracle_price, this.unit_mint);
		this.input_fee_ppk = keyset.input_fee_ppk;
		this.active = keyset.active;
		this.assets = assets;
		this.assets_oracle = oracleConvertToUSDCents(this.assets, oracle_price, this.unit_lightning);
		this.derivation_path_index = keyset.derivation_path_index;
		this.first_seen = keyset.valid_from;
	}
}
