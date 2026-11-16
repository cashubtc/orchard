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
	/** A local server that sends each connection one message; resolves with the outcome a socket to the given host sees */
	const connect = async (host: string, message: string, allowsLocal: boolean): Promise<string> => {
		const server = new WebSocketServer({host: '127.0.0.1', port: 0});
		await new Promise((resolve) => server.once('listening', resolve));
		server.on('connection', (connection) => connection.send(message));
		const CashuWalletSocket = createCashuWalletSocket({agentFor: () => undefined}, () => allowsLocal);
		const socket = new CashuWalletSocket(`ws://${host}:${(server.address() as AddressInfo).port}`);
		const outcome = await new Promise<string>((resolve) => {
			socket.onmessage = () => resolve('received');
			socket.onerror = (event) => resolve((event as unknown as {message: string}).message);
		});
		socket.close();
		await new Promise((resolve) => server.close(resolve));
		return outcome;
	};

	it('opens each socket through the agent FetchService picks for its address', () => {
		const agent = new Agent();
		const add_request = jest.spyOn(agent as any, 'addRequest').mockImplementation(() => undefined);
		const agentFor = jest.fn((_url: string) => agent as any);
		const CashuWalletSocket = createCashuWalletSocket({agentFor}, () => false);
		const socket = new CashuWalletSocket('ws://mint.example/v1/ws');
		socket.onerror = () => undefined;
		expect(agentFor).toHaveBeenCalledWith('ws://mint.example/v1/ws');
		expect(add_request).toHaveBeenCalled();
		socket.close();
	});

	it('drops a mint message larger than a mint response may be', async () => {
		expect(await connect('127.0.0.1', 'x'.repeat(CASHU_WALLET_MINT_MAX_BYTES + 1), true)).toBe('Max payload size exceeded');
	});

	it.each([
		['refuses', false, expect.stringContaining("Blocked: 'localhost' resolves to private/reserved IP")],
		['opens', true, 'received'],
	])('%s a socket to a host that resolves to a local address, as that host may be local', async (_label, allowed, outcome) => {
		expect(await connect('localhost', 'hello', allowed)).toEqual(outcome);
	});
});
