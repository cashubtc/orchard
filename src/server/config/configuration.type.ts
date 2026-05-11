export type Config = {
	mode: {
		production: boolean;
		dev_auth_bypass: boolean;
		schema_only: boolean;
		docker: boolean;
		version: string;
	};
	server: {
		host: string;
		port: string;
		path: string;
		proxy: string | undefined;
		log: string;
		setup_key: string;
		crypto_key: string;
		jwt_secret: string;
		ttl: string;
		limit: string;
		compression: boolean;
	};
	database: {
		path: string;
		synchronize: boolean;
	};
	bitcoin: {
		type: string;
		host: string;
		port: string;
		user: string;
		pass: string;
	};
	lightning: {
		type: string;
		host: string;
		port: string;
		macaroon: string;
		cert: string;
		key: string;
		ca: string;
	};
	taproot_assets: {
		type: string;
		host: string;
		port: string;
		macaroon: string;
		cert: string;
	};
	cashu: {
		type: string;
		api: string;
		database_type: string;
		database: string;
		database_ca: string;
		database_cert: string;
		database_key: string;
		rpc_host: string;
		rpc_port: string;
		rpc_mtls: boolean;
		rpc_key: string;
		rpc_cert: string;
		rpc_ca: string;
	};
};
