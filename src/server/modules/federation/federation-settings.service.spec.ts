/* Core Dependencies */
import {Test} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {Response} from 'node-fetch';

/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';

/* Local Dependencies */
import {FederationService} from './federation.service.js';
import {FederationSettingsService} from './federation-settings.service.js';

/** Build a complete current federation with public URLs for every member. */
function federationInfo(): Awaited<ReturnType<FederationService['getInfo']>> {
	return {
		federation_id: 'federation-a',
		local_member_id: 1,
		config_digest: 'config-a',
		wallet_protocol_version: 1,
		threshold_params: null,
		keysets: [],
		payment_observation_policy: null,
		members: [1, 2, 3].map((member_id) => ({
			member_id,
			public_mint_url: `https://mint${member_id}.example/base/`,
			federation_api_url: `https://peer${member_id}.example`,
			identity_public_key: `key-${member_id}`,
		})),
	};
}

/** Build representative public metadata and both payment configurations. */
function publicInfo(): Record<string, unknown> {
	return {
		name: 'Shared mint',
		description: 'description',
		description_long: 'long description',
		motd: 'hello',
		icon_url: 'https://mint.example/icon.png',
		contact: [{method: 'nostr', info: 'npub'}],
		nuts: {
			'4': {
				disabled: false,
				methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 1000, options: {description: true}}],
			},
			'5': {
				disabled: false,
				methods: [{method: 'bolt11', unit: 'sat', min_amount: 2, max_amount: 2000, options: {amountless: true}}],
			},
		},
	};
}

describe('FederationSettingsService', () => {
	let service: FederationSettingsService;
	let info: ReturnType<typeof federationInfo>;
	let connection: Record<string, unknown>;
	let bodies: Record<string, Record<string, unknown>>;
	const get_info = jest.fn();
	const fetch = jest.fn<ReturnType<FetchService['fetchWithProxy']>, Parameters<FetchService['fetchWithProxy']>>();

	beforeEach(async () => {
		info = federationInfo();
		connection = {'cashu.rpc_host': 'mint1', 'cashu.rpc_port': 8086};
		bodies = Object.fromEntries(info.members.map((member) => [`${member.public_mint_url}v1/info`, publicInfo()]));
		get_info.mockReset().mockImplementation(async () => info);
		fetch.mockReset().mockImplementation(async (url) => new Response(JSON.stringify(bodies[url])));
		const module = await Test.createTestingModule({
			providers: [
				FederationSettingsService,
				{provide: FederationService, useValue: {getInfo: get_info}},
				{provide: FetchService, useValue: {fetchWithProxy: fetch}},
				{provide: ConfigService, useValue: {get: (key: string): unknown => connection[key]}},
			],
		}).compile();
		service = module.get(FederationSettingsService);
	});

	afterEach(() => jest.restoreAllMocks());

	it('compares all public endpoints including local in parallel with five-second deadlines', async () => {
		const timeout = jest.spyOn(AbortSignal, 'timeout');
		const pending = new Map<string, (response: Response) => void>();
		fetch.mockImplementation((url) => new Promise((resolve) => pending.set(url, resolve)));
		const comparison = service.getComparison();
		await Promise.resolve();
		await Promise.resolve();
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(timeout.mock.calls).toEqual([[5000], [5000], [5000]]);
		for (const [url, resolve] of pending) {
			expect(fetch).toHaveBeenCalledWith(url, {method: 'GET', signal: expect.any(AbortSignal)});
			resolve(new Response(JSON.stringify(bodies[url])));
		}
		const result = await comparison;
		expect(result).toMatchObject({
			federation_id: 'federation-a',
			local_member_id: 1,
			default_quote_member_id: 1,
			baseline_available: true,
			checked_at: expect.any(Number),
		});
		expect(
			result.members.map(({member_id, local, status, error, differences}) => ({member_id, local, status, error, differences})),
		).toEqual([1, 2, 3].map((member_id) => ({member_id, local: member_id === 1, status: 'matches', error: null, differences: []})));
	});

	it('reports a different method limit with its NUT, method and unit', async () => {
		bodies['https://mint2.example/base/v1/info'].nuts = {
			'4': {
				disabled: false,
				methods: [{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 2000, options: {description: true}}],
			},
			'5': (publicInfo().nuts as Record<string, unknown>)['5'],
		};
		const result = await service.getComparison();
		expect(result.members[1]).toMatchObject({
			status: 'differs',
			differences: [
				{
					group: 'config',
					setting: 'max_amount',
					nut: 4,
					method: 'bolt11',
					unit: 'sat',
					this_member_value: '1000',
					their_value: '2000',
				},
			],
		});
		expect(result.members[2].status).toBe('matches');
	});

	it('reports a missing payment method once instead of manufacturing default settings', async () => {
		bodies['https://mint2.example/base/v1/info'].nuts = {
			'4': {disabled: false, methods: []},
			'5': (publicInfo().nuts as Record<string, unknown>)['5'],
		};
		const result = await service.getComparison();
		expect(result.members[1].differences).toEqual([
			{
				group: 'config',
				setting: 'method',
				nut: 4,
				method: 'bolt11',
				unit: 'sat',
				this_member_value: 'true',
				their_value: 'false',
			},
		]);
	});

	it('treats an absent disabled flag as enabled', async () => {
		delete (bodies['https://mint2.example/base/v1/info'].nuts as Record<string, Record<string, unknown>>)['4'].disabled;
		const result = await service.getComparison();
		expect(result.members[1].status).toBe('matches');
	});

	it('retains an unreachable peer diagnostic while comparing the remaining members', async () => {
		fetch.mockImplementation(async (url) => {
			if (url.includes('mint2')) throw new Error('connect ECONNREFUSED 127.0.0.1:3338');
			return new Response(JSON.stringify(bodies[url]));
		});
		const result = await service.getComparison();
		expect(result.members[1]).toMatchObject({status: 'unavailable', error: 'connect ECONNREFUSED 127.0.0.1:3338', differences: []});
		expect(result.members[2].status).toBe('matches');
	});

	it.each(['iroh://member2', 'ftp://member2/info'])('marks %s not comparable without fetching it', async (url) => {
		info.members[1].public_mint_url = url;
		const result = await service.getComparison();
		expect(result.members[1]).toMatchObject({status: 'not_comparable', error: "Can't be compared from Orchard", differences: []});
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('never claims a peer matches when the local public endpoint is unavailable', async () => {
		fetch.mockImplementation(async (url) => {
			if (url.includes('mint1')) throw new Error('Local public endpoint failed');
			return new Response(JSON.stringify(bodies[url]));
		});
		const result = await service.getComparison();
		expect(result.baseline_available).toBe(false);
		expect(result.members[0]).toMatchObject({local: true, status: 'unavailable', error: 'Local public endpoint failed'});
		expect(result.members.slice(1).map((member) => [member.status, member.error])).toEqual([
			['not_comparable', null],
			['not_comparable', null],
		]);
	});

	it('does not invent a baseline when the local member is absent from the configuration', async () => {
		info.local_member_id = 9;
		const result = await service.getComparison();
		expect(result.baseline_available).toBe(false);
		expect(result.members.every((member) => member.status === 'not_comparable')).toBe(true);
	});

	it.each([
		['mint is restarting\n', '503: mint is restarting'],
		['{"detail":"Mint is unavailable"}', '503: Mint is unavailable'],
		['{"error":"Backend busy"}', '503: Backend busy'],
		['', '503'],
	])('preserves the upstream HTTP diagnostic from %j', async (body, error) => {
		fetch.mockResolvedValue(new Response(body, {status: 503}));
		const result = await service.getComparison();
		expect(result.members[0]).toMatchObject({status: 'unavailable', error});
	});

	it('relays only a short excerpt of a proxy error page', async () => {
		fetch.mockResolvedValue(new Response(`<html>\n<body>${'x'.repeat(500)}</body></html>`, {status: 502, statusText: 'Bad Gateway'}));
		const result = await service.getComparison();
		expect(result.members[0].error?.startsWith('502 Bad Gateway: <html> <body>xxx')).toBe(true);
		expect(result.members[0].error?.length).toBeLessThan(230);
	});

	it('caches for sixty seconds and supports an explicit refresh', async () => {
		const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
		const first = await service.getComparison();
		expect(await service.getComparison()).toBe(first);
		expect(fetch).toHaveBeenCalledTimes(3);
		const refreshed = await service.getComparison(true);
		expect(refreshed).not.toBe(first);
		expect(fetch).toHaveBeenCalledTimes(6);
		clock.mockReturnValue(61001);
		await service.getComparison();
		expect(fetch).toHaveBeenCalledTimes(9);
	});

	it('starts a fresh comparison after the mint connection changes', async () => {
		await service.getComparison();
		connection = {...connection, 'cashu.rpc_host': 'replacement'};
		await service.getComparison();
		expect(fetch).toHaveBeenCalledTimes(6);
	});

	it('shares a read in flight, while a refresh reads again', async () => {
		await Promise.all([service.getComparison(), service.getComparison(), service.getComparison(true)]);
		expect(fetch).toHaveBeenCalledTimes(6);
	});

	it('does not cache an old request over a replacement connection', async () => {
		const pending: Array<(response: Response) => void> = [];
		fetch.mockImplementationOnce(() => new Promise((resolve) => pending.push(resolve)));
		const old_request = service.getComparison();
		await Promise.resolve();
		await Promise.resolve();
		connection = {...connection, 'cashu.rpc_host': 'replacement'};
		const current = await service.getComparison();
		pending[0](new Response(JSON.stringify(publicInfo())));
		await old_request;
		expect(await service.getComparison()).toBe(current);
		expect(fetch).toHaveBeenCalledTimes(6);
	});

	it('preserves exact uint64 limits instead of rounding two different limits to the same number', async () => {
		fetch.mockImplementation(
			async (url) =>
				new Response(
					`{"nuts":{"4":{"methods":[{"method":"bolt11","unit":"sat","max_amount":${url.includes('mint2') ? '9007199254740993' : '9007199254740992'}}]}}}`,
				),
		);
		const result = await service.getComparison();
		expect(result.members[1].differences).toEqual([
			{
				group: 'config',
				setting: 'max_amount',
				nut: 4,
				method: 'bolt11',
				unit: 'sat',
				this_member_value: '9007199254740992',
				their_value: '9007199254740993',
			},
		]);
	});
});
