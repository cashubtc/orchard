/* *******************************************************
	Options
******************************************************** */

/** How a call treats a failing node: `strict` throws the node's error instead of returning null, `timeout_ms` gives up on one that doesn't answer */
export type BitcoinRpcOptions = {
	strict?: boolean;
	timeout_ms?: number;
};

/* *******************************************************
	Blockchain
******************************************************** */

export type BitcoinBlockchainInfo = {
	chain: string;
	blocks: number;
	headers: number;
	bestblockhash: string;
	difficulty: number;
	mediantime: number;
	verificationprogress: number;
	initialblockdownload: boolean;
	chainwork: string;
	size_on_disk: number;
	pruned: boolean;
	pruneheight: number;
	automatic_pruning: boolean;
	prune_target_size: number;
	warnings: string[];
	softforks: {
		[key: string]: {
			type: string;
			bip9: {
				status: string;
				bit: number;
				start_time: number;
				timeout: number;
				since: number;
				statistics: {
					period: number;
					threshold: number;
					elapsed: number;
					count: number;
					possible: boolean;
				};
				height: number;
				active: boolean;
			};
		};
	};
};

export type BitcoinBlock = {
	hash: string;
	confirmations: number;
	height: number;
	version: number;
	versionHex: string;
	merkleroot: string;
	time: number;
	mediantime: number;
	nonce: number;
	bits: string;
	difficulty: number;
	chainwork: string;
	nTx: number;
	previousblockhash: string;
	nextblockhash: string;
	strippedsize: number;
	size: number;
	weight: number;
	tx: BitcoinRawTransaction[];
};

/* *******************************************************
	Network
******************************************************** */

export type BitcoinNetworkInfo = {
	version: number;
	subversion: string;
	protocolversion: number;
	localservices: string;
	localservicesnames: string[];
	localrelay: boolean;
	timeoffset: number;
	connections: number;
	connections_in: number;
	connections_out: number;
	networkactive: boolean;
	networks: {
		name: string;
		limited: boolean;
		reachable: boolean;
		proxy: string;
		proxy_randomize_credentials: boolean;
	}[];
	relayfee: number;
	incrementalfee: number;
	localaddresses: {
		address: string;
		port: number;
		score: number;
	}[];
	warnings: string[];
};

/* *******************************************************
	Mempool
******************************************************** */

export type BitcoinTransaction = {
	vsize: number;
	weight: number;
	time: number;
	height: number;
	descendantcount: number;
	descendantsize: number;
	ancestorcount: number;
	ancestorsize: number;
	wtxid: string;
	fees: {
		base: number;
		modified: number;
		ancestor: number;
		descendant: number;
	};
	depends: string[];
	spentby: string[];
	'bip125-replaceable': boolean;
	unbroadcast: boolean;
};

/* *******************************************************
	Transaction
******************************************************** */

export interface BitcoinRawTransaction {
	in_active_chain?: boolean;
	txid: string;
	hash: string;
	size: number;
	vsize: number;
	weight: number;
	version: number;
	locktime: number;
	fee: number;
	vin: Array<{
		txid: string;
		vout: number;
		scriptSig: {
			asm: string;
			hex: string;
		};
		sequence: number;
		txinwitness?: string[];
	}>;
	vout: Array<{
		value: number;
		n: number;
		scriptPubKey: {
			asm: string;
			hex: string;
			reqSigs?: number;
			type: string;
			address?: string;
			addresses?: string[];
		};
	}>;
	blockhash?: string;
	confirmations?: number;
	blocktime?: number;
	time?: number;
}

export type BitcoinTxOut = {
	bestblock: string;
	confirmations: number;
	value: number;
	scriptPubKey: {
		asm: string;
		hex: string;
		type: string;
		address?: string;
	};
	coinbase: boolean;
};

/* *******************************************************
	Mining
******************************************************** */

export type BitcoinBlockTemplate = {
	version: number;
	rules: string[];
	vbavailable: {
		[rulename: string]: number;
	};
	vbrequired: number;
	previousblockhash: string;
	transactions: {
		data: string;
		txid: string;
		hash: string;
		depends: number[];
		fee: number;
		sigops: number;
		weight: number;
	}[];
	coinbaseaux: {
		[key: string]: string;
	};
	coinbasevalue: number;
	longpollid: string;
	target: string;
	mintime: number;
	mutable: string[];
	noncerange: string;
	sigoplimit: number;
	sizelimit: number;
	weightlimit: number;
	curtime: number;
	bits: string;
	height: number;
	default_witness_commitment?: string;
};

/* *******************************************************
	Utilities
******************************************************** */

export type BitcoinFeeEstimate = {
	feerate?: number;
	errors?: string[];
	blocks: number;
};
