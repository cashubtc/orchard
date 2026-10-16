/* Native Dependencies */
import {MintContactMethod} from '@client/modules/mint/types/mint-contact.types';
import {MintNut} from '@client/modules/mint/types/nut.types';
/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';

/** What each NUT is called wherever a mint's settings are shown */
export const MINT_NUT_TITLES: Record<MintNut, string> = {
	nut4: 'Minting',
	nut5: 'Melting',
	nut7: 'Token check',
	nut8: 'Lightning fee',
	nut9: 'Restore signatures',
	nut10: 'Spending conditions',
	nut11: 'P2Pk',
	nut12: 'Offline validation',
	nut14: 'HTLCs',
	nut15: 'PMP payments',
	nut17: 'Websockets',
	nut19: 'Cached responses',
	nut20: 'Quote signature',
	nut21: 'Clear auth',
	nut22: 'Blind auth',
	nut29: 'Batched minting',
};

/** The ways a mint can publish a contact */
export const MINT_CONTACT_METHODS: MintContactMethod[] = [
	{label: 'Email', method: 'email', icon: 'mail', svg: ''},
	{label: 'X', method: 'twitter', icon: '', svg: 'x'},
	{label: 'Nostr', method: 'nostr', icon: '', svg: 'nostr'},
];

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

/** Reserve sources grouped by the backend that holds them */
export const RESERVE_SOURCE_GROUPS: readonly {label: string; sources: readonly MintReserveSource[]}[] = [
	{label: 'Lightning', sources: [...CHANNEL_RESERVE_SOURCES, MintReserveSource.LightningWallet]},
	{label: 'Mint', sources: [MintReserveSource.MintWallet]},
];
