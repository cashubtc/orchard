export type Config = {
	mode: {
		production: boolean;
		dev_auth_bypass: boolean;
		version: string;
	};
	api: {
		proxy: string;
		path: string;
	};
	bitcoin: {
		enabled: boolean;
	};
	lightning: {
		enabled: boolean;
	};
	taproot_assets: {
		enabled: boolean;
	};
	mint: {
		enabled: boolean;
		type: string;
		critical_path: string;
		database_type: string;
		metrics: boolean;
	};
	constants: {
		epoch_start: number;
		taproot_group_keys: {
			usdt: string;
		};
	};
};
