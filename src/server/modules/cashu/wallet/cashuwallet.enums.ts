// Wallet-local proof state; the mint's view (CheckStateEnum) can't tell a sent-but-unclaimed proof from an owned one
export enum WalletProofState {
	READY = 'READY',
	INFLIGHT = 'INFLIGHT',
	SPENT = 'SPENT',
}

export enum WalletOperationType {
	MINT = 'MINT',
}

export enum WalletOperationState {
	PENDING = 'PENDING',
	EXECUTING = 'EXECUTING',
	FINALIZED = 'FINALIZED',
	FAILED = 'FAILED',
}
