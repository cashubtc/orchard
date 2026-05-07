/**
 * Stack-matrix type vocabulary. Defines the shape of the per-stack config
 * `helpers/config.ts` holds — type-only file, no runtime exports, importable
 * from anywhere in `e2e/` without dragging in CONFIGS or filesystem reads.
 */

export type ConfigName = 'lnd-nutshell-sqlite' | 'lnd-cdk-sqlite' | 'cln-cdk-postgres' | 'cln-nutshell-postgres' | 'fake-cdk-postgres';

export type LnType = 'lnd' | 'cln';
export type MintType = 'nutshell' | 'cdk';
export type DbType = 'sqlite' | 'postgres';
export type MintUnit = 'sat' | 'usd' | 'eur';

/** App-level (server-persisted) settings driven via `/settings/app`. Each
 *  field is optional — `undefined` means the settings setup helper skips
 *  the corresponding form entirely, leaving the server default in place. */
export type AppSettingValues = {
	bitcoin_oracle?: boolean;
	ai_enabled?: boolean;
	ai_vendor?: 'ollama' | 'openrouter';
	ai_ollama_api?: string;
};

/** Device-level (localStorage) settings driven via `/settings/device`. Each
 *  field is optional — `undefined` skips the form, leaving the localStorage
 *  key absent so the app falls back to system defaults. */
export type DeviceSettingValues = {
	theme?: 'dark-mode' | 'light-mode';
	locale?: string;
	timezone?: string;
	currency_btc?: 'code' | 'glyph';
	currency_fiat?: 'code' | 'glyph';
	/** Exact model name as returned by `ai_models` (e.g. `llama3.2`). Only
	 *  meaningful on AI-enabled stacks — device setting, localStorage-persisted. */
	ai_model?: string;
};

/** Named LN peer within a config's topology. `far` is always LND. */
export type LnNode = 'orchard' | 'alice' | 'far';

interface BaseConfigInfo {
	name: ConfigName;
	mint: MintType;
	db: DbType;
	/** Stack runs a bitcoind container and Orchard boots with BITCOIN_TYPE.
	 *  False only on fake-cdk-postgres — that stack exercises Orchard's
	 *  no-bitcoin code path alongside its no-LN path. */
	bitcoin: boolean;
	tapd: boolean;
	/** Mint + LN backend both speak offers. */
	bolt12: boolean;
	/** Stack ships a `compose.mainchain.yml` overlay. The overlay is always
	 *  loaded when present, and `@mainchain` is always in this stack's grep. */
	mainchain: boolean;
	orchardUrl: string;
	setupKey: string;
	/** Server-persisted settings the settings setup phase applies via
	 *  `/settings/app`. Absent fields are skipped, leaving server defaults. */
	appSettings?: AppSettingValues;
	/** localStorage-persisted settings the settings setup phase applies via
	 *  `/settings/device`. Absent fields are skipped, leaving system defaults. */
	deviceSettings?: DeviceSettingValues;
}

/** Discriminated on `ln`: no-LN stacks (`ln: false`) have no LN containers
 *  at all, so accessing `lnOrchard` / `lnAlice` / `lnFar` on them is a
 *  compile error. Today the no-LN stack also has no `bitcoind` container. */
export type ConfigInfo =
	| (BaseConfigInfo & {
			ln: LnType;
			containers: {
				bitcoind: string;
				/** Orchard's managed LN node. */
				lnOrchard: string;
				/** External peer connected directly to orchard (inbound liquidity). */
				lnAlice: string;
				/** Far-side peer forcing routing through orchard (outbound / forwarding). */
				lnFar: string;
				/** The mint daemon container — `nutshell` or `cdk-mintd` flavour
				 *  per `config.mint`. Used by `backend.mint.getInfo()` to fetch
				 *  the daemon's live `/v1/info` (NUT-06) over a docker-exec'd
				 *  curl/wget against the in-container loopback port. */
				mint: string;
			};
			/** In-container port the mint daemon listens on. nutshell pins
			 *  3338; cdk varies per stack via `mintd.toml`. */
			mintPort: number;
	  })
	| (BaseConfigInfo & {
			ln: false;
			containers: {mint: string};
			mintPort: number;
	  });
