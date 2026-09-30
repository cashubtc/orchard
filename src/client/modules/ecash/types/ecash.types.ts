import {
	OrchardCommonCount,
	OrchardEcashBalance,
	OrchardEcashMint,
	OrchardEcashMintStatus,
	OrchardEcashOperation,
	OrchardEcashSeed,
} from '@shared/generated.types';

export type EcashMintsResponse = {
	ecash_mints: OrchardEcashMint[];
};

export type EcashBalancesResponse = {
	ecash_balances: OrchardEcashBalance[];
};

export type EcashMintStatusResponse = {
	ecash_mint_status: OrchardEcashMintStatus[];
};

export type EcashSeedResponse = {
	ecash_seed: OrchardEcashSeed | null;
};

export type EcashOperationsDataResponse = {
	ecash_operations: OrchardEcashOperation[];
	ecash_operation_count: OrchardCommonCount;
};

export type EcashIssueResponse = {
	ecash_issue: OrchardEcashOperation;
};

export type EcashMintAddResponse = {
	ecash_mint_add: OrchardEcashMint;
};

export type EcashMintRemoveResponse = {
	ecash_mint_remove: boolean;
};

export type EcashSeedRevealResponse = {
	ecash_seed_reveal: string;
};

export type EcashSeedBackupResponse = {
	ecash_seed_backup: OrchardEcashSeed;
};
