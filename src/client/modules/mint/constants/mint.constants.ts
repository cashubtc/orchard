/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';

/** Every channel's outbound, active or not: the reserves Orchard has always counted toward solvency */
export const DEFAULT_SOLVENCY_SOURCES: readonly MintReserveSource[] = [
	MintReserveSource.LightningActive,
	MintReserveSource.LightningInactive,
];
