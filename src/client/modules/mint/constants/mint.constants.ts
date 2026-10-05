/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';

/** Outbound liquidity in the node's channels, active or not */
export const CHANNEL_RESERVE_SOURCES: readonly MintReserveSource[] = [
	MintReserveSource.LightningActive,
	MintReserveSource.LightningInactive,
];

/** What each reserve source is called wherever reserves are shown */
export const RESERVE_SOURCE_LABELS: Record<MintReserveSource, string> = {
	[MintReserveSource.LightningActive]: 'Active channel outbound',
	[MintReserveSource.LightningInactive]: 'Inactive channel outbound',
	[MintReserveSource.LightningWallet]: 'Lightning hot wallet',
	[MintReserveSource.MintWallet]: 'Mint on-chain wallet',
};
