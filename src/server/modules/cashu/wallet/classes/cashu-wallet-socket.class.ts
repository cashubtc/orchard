/* Core Dependencies */
import type {LookupFunction} from 'net';
/* Vendor Dependencies */
import WebSocket from 'ws';
/* Application Dependencies */
import type {FetchService} from '#server/modules/fetch/fetch.service';
import {lookupPublic} from '#server/modules/fetch/network-guard';
/* Native Dependencies */
import {CASHU_WALLET_MINT_MAX_BYTES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';

/**
 * WebSocket class for cashu-ts that reaches each mint the way FetchService does: through the Tor proxy unless it's local, with the
 * same size cap; a direct socket refuses a host that resolves to a private address unless that host may be local
 */
export const createCashuWalletSocket = (
	fetch_service: Pick<FetchService, 'agentFor'>,
	allowsLocal: (url: string) => boolean,
): typeof globalThis.WebSocket =>
	class CashuWalletSocket extends WebSocket {
		constructor(address: string | URL) {
			const url = String(address);
			const agent = fetch_service.agentFor(url);
			const lookup = agent || allowsLocal(url) ? undefined : lookupPublic;
			const options: WebSocket.ClientOptions & {lookup?: LookupFunction} = {agent, lookup, maxPayload: CASHU_WALLET_MINT_MAX_BYTES};
			super(address, options);
		}
	} as unknown as typeof globalThis.WebSocket;
