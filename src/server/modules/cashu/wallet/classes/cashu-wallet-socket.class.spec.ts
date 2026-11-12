/* Core Dependencies */
import {Agent} from 'http';
import type {AddressInfo} from 'net';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {WebSocketServer} from 'ws';
/* Native Dependencies */
import {CASHU_WALLET_MINT_MAX_BYTES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
/* Local Dependencies */
import {createCashuWalletSocket} from './cashu-wallet-socket.class.js';

describe('createCashuWalletSocket', () => {
	it('opens each socket through the agent FetchService picks for its address', () => {
		const agent = new Agent();
		const add_request = jest.spyOn(agent as any, 'addRequest').mockImplementation(() => undefined);
		const agentFor = jest.fn((_url: string) => agent as any);
		const CashuWalletSocket = createCashuWalletSocket({agentFor});
		const socket = new CashuWalletSocket('ws://mint.example/v1/ws');
		socket.onerror = () => undefined;
		expect(agentFor).toHaveBeenCalledWith('ws://mint.example/v1/ws');
		expect(add_request).toHaveBeenCalled();
		socket.close();
	});

	it('drops a mint message larger than a mint response may be', async () => {
		const server = new WebSocketServer({host: '127.0.0.1', port: 0});
		await new Promise((resolve) => server.once('listening', resolve));
		server.on('connection', (connection) => connection.send('x'.repeat(CASHU_WALLET_MINT_MAX_BYTES + 1)));
		const CashuWalletSocket = createCashuWalletSocket({agentFor: () => undefined});
		const socket = new CashuWalletSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}`);
		const outcome = await new Promise((resolve) => {
			socket.onmessage = () => resolve('received');
			socket.onerror = (event) => resolve((event as unknown as {message: string}).message);
		});
		await new Promise((resolve) => server.close(resolve));
		expect(outcome).toBe('Max payload size exceeded');
	});
});
