/** NUT-06 `/v1/info` shape, narrowed to the fields the dashboard's mint
 *  cards render. The full Cashu spec includes `pubkey`, etc. — add
 *  fields here as specs need them. `urls` is optional in NUT-06 and
 *  null/missing on fixtures that don't advertise public URLs. */
export type MintNutInfo = {
	name?: string | null;
	description?: string | null;
	description_long?: string | null;
	icon_url?: string | null;
	motd?: string | null;
	urls?: string[] | null;
	contact?: Array<{method: string; info: string}> | null;
	version?: string;
	nuts?: MintNutsBlock;
};

/** NUT-04 / NUT-05 method entry. The mint daemon emits `min_amount` and
 *  `max_amount` as numbers when bounded and `null` when unbounded (cdk
 *  publishes both; nutshell publishes neither and the orc-mint-general-config
 *  card falls back to `1` for min and `∞` for max). */
export type MintNutLimitMethod = {
	method: string;
	unit: string;
	min_amount?: number | null;
	max_amount?: number | null;
};

/** NUT-04 minting / NUT-05 melting block. `disabled: true` flips the
 *  status pill and the chip dot palette in `orc-mint-general-config`. */
export type MintNutLimitBlock = {
	disabled: boolean;
	methods: MintNutLimitMethod[];
};

/** The `nuts` map on `/v1/info`. NUT-04 / NUT-05 are always present;
 *  every other key is loosened to `unknown` because the daemon emits
 *  several distinct shapes (some `{supported: boolean}`, some
 *  `{methods: …}`, some `{supported: […]}` arrays, and nutshell sends a
 *  literal `null` for keys it does not implement — e.g. `nut19`).
 *  `orc-mint-general-config`'s `getNutStatus` handles all of these via
 *  duck-typing; tests reading this block do the same. */
export type MintNutsBlock = {
	nut4: MintNutLimitBlock;
	nut5: MintNutLimitBlock;
	[key: string]: unknown;
};
