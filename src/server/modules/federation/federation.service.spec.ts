/* Core Dependencies */
import {Test} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {CdkRpcError, CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
/* Native Dependencies */
import {FederationService} from './federation.service.js';

describe('FederationService', () => {
	let service: FederationService;
	const request = jest.fn();
	const get = jest.fn();
	const absent = new CdkRpcError(status.UNIMPLEMENTED, 'absent');
	const respond = (setup: unknown, info: unknown): void => {
		request.mockImplementation((method: string) => {
			const outcome = method === 'GetSetupStatus' ? setup : info;
			return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
		});
	};
	beforeEach(async () => {
		request.mockReset();
		get.mockReset().mockReturnValue('cdk');
		const module = await Test.createTestingModule({
			providers: [FederationService, {provide: CdkRpcService, useValue: {request}}, {provide: ConfigService, useValue: {get}}],
		}).compile();
		service = module.get(FederationService);
	});
	it('probes setup and federation services together', async () => {
		respond({initialized: false}, absent);
		await expect(service.getMode()).resolves.toEqual({mode: 'setup', details: null});
		expect(request).toHaveBeenCalledWith('GetSetupStatus', {}, 5000);
		expect(request).toHaveBeenCalledWith('GetFederationInfo', {}, 5000);
	});
	it('recognizes members and standalone mints', async () => {
		respond(absent, {});
		await expect(service.getMode()).resolves.toEqual({mode: 'member', details: null});
		respond(absent, new CdkRpcError(status.FAILED_PRECONDITION, 'not federated'));
		await expect(service.getMode()).resolves.toEqual({mode: 'standalone', details: null});
	});
	it('treats a cdk mint without a management connection as standalone', async () => {
		get.mockImplementation((key: string) => (key === 'cashu.type' ? 'cdk' : undefined));
		await expect(service.getMode()).resolves.toEqual({mode: 'standalone', details: null});
		expect(request).not.toHaveBeenCalled();
	});
	it('recognizes a setup daemon whose status call is slow', async () => {
		respond(new CdkRpcError(status.DEADLINE_EXCEEDED, 'Deadline exceeded'), new CdkRpcError(status.UNIMPLEMENTED, ''));
		await expect(service.getMode()).resolves.toEqual({mode: 'setup', details: null});
	});
	it('treats a daemon without either federation service as standalone', async () => {
		respond(absent, absent);
		await expect(service.getMode()).resolves.toEqual({mode: 'standalone', details: null});
	});
	it.each([status.UNAVAILABLE, status.DEADLINE_EXCEEDED])('reports connection status %s with the original diagnostic', async (code) => {
		const error = new CdkRpcError(code, 'connection diagnostic');
		respond(error, error);
		await expect(service.getMode()).resolves.toEqual({mode: 'unreachable', details: 'connection diagnostic'});
	});
	it.each([status.RESOURCE_EXHAUSTED, status.INVALID_ARGUMENT, status.PERMISSION_DENIED])('surfaces error %s unchanged', async (code) => {
		const error = new CdkRpcError(code, 'verbatim');
		respond(absent, error);
		await expect(service.getMode()).rejects.toBe(error);
	});
	it('skips federation probes for Nutshell', async () => {
		get.mockReturnValue('nutshell');
		await expect(service.getMode()).resolves.toEqual({mode: 'standalone', details: null});
		expect(request).not.toHaveBeenCalled();
	});
	it('rejects standalone mutations in setup and allows them in standalone mode', async () => {
		respond({}, absent);
		await expect(service.assertStandaloneOperation()).rejects.toMatchObject({grpc_code: status.FAILED_PRECONDITION});
		respond(absent, new CdkRpcError(status.FAILED_PRECONDITION, 'standalone'));
		await expect(service.assertStandaloneOperation()).resolves.toBeUndefined();
	});
	it.each([
		['getInfo', 'GetFederationInfo'],
		['getLocalStatus', 'GetLocalStatus'],
		['getMemberStatuses', 'GetMemberStatuses'],
		['getCustodyStatus', 'GetCustodyStatus'],
	] as const)('forwards %s unchanged, including optional sections and exact counters', async (method, rpc_method) => {
		const response = {onchain_wallets: [], bark: undefined, counter: '18446744073709551615'};
		request.mockResolvedValue(response);
		await expect(service[method]()).resolves.toEqual(response);
		expect(request).toHaveBeenCalledWith(rpc_method, {});
		const error = new CdkRpcError(status.RESOURCE_EXHAUSTED, 'Status requests busy');
		request.mockRejectedValue(error);
		await expect(service[method]()).rejects.toBe(error);
	});
});
