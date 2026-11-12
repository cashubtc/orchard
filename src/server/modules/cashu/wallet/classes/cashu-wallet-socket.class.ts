/* Vendor Dependencies */
import WebSocket from 'ws';
/* Application Dependencies */
import type {FetchService} from '#server/modules/fetch/fetch.service';
/* Native Dependencies */
import {CASHU_WALLET_MINT_MAX_BYTES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';

/** WebSocket class for cashu-ts that reaches each mint the way FetchService does: through the Tor proxy unless it's local, with the same size cap */
export const createCashuWalletSocket = (fetch_service: Pick<FetchService, 'agentFor'>): typeof globalThis.WebSocket =>
	class CashuWalletSocket extends WebSocket {
		constructor(address: string | URL) {
			super(address, {agent: fetch_service.agentFor(String(address)), maxPayload: CASHU_WALLET_MINT_MAX_BYTES});
		}
	} as unknown as typeof globalThis.WebSocket;
