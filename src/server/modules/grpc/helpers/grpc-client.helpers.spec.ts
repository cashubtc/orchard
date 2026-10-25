import type {Client} from '@grpc/grpc-js';
import {closeGrpcChannel} from './grpc-client.helpers.js';

describe('closeGrpcChannel', () => {
	it('closes the channel without invoking a generated close RPC', () => {
		const channel_close = jest.fn();
		const close_rpc = jest.fn();
		closeGrpcChannel({getChannel: () => ({close: channel_close}), close: close_rpc} as unknown as Client);
		expect(channel_close).toHaveBeenCalledTimes(1);
		expect(close_rpc).not.toHaveBeenCalled();
	});
});
