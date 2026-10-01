export enum MintType {
	NUTSHELL = 'nutshell',
	CDK = 'cdk',
}

export enum MintQuoteState {
	UNPAID = 'UNPAID',
	PENDING = 'PENDING',
	PAID = 'PAID',
	ISSUED = 'ISSUED',
}

export enum MeltQuoteState {
	UNPAID = 'UNPAID',
	PENDING = 'PENDING',
	PAID = 'PAID',
}

export enum MintProofState {
	SPENT = 'SPENT',
}

export enum MintReserveSource {
	LIGHTNING_ACTIVE = 'LIGHTNING_ACTIVE',
	LIGHTNING_INACTIVE = 'LIGHTNING_INACTIVE',
	LIGHTNING_WALLET = 'LIGHTNING_WALLET',
	MINT_WALLET = 'MINT_WALLET',
}

export enum MintReserveStatus {
	AVAILABLE = 'AVAILABLE',
	UNCONFIGURED = 'UNCONFIGURED',
	UNSUPPORTED = 'UNSUPPORTED',
	UNAVAILABLE = 'UNAVAILABLE',
}
