import {compareFederationPublicSettings, parseFederationPublicInfo, readFederationPublicSettings} from './federation-settings.helpers.js';

/** Compare selected settings from two public info responses. */
function differences(local: unknown, peer: unknown): ReturnType<typeof compareFederationPublicSettings> {
	return compareFederationPublicSettings(readFederationPublicSettings(local), readFederationPublicSettings(peer));
}

describe('Federation public settings comparison', () => {
	it('treats absent fields as empty and excludes URLs, versions, pubkeys, time and quote TTLs', () => {
		expect(
			differences(
				{},
				{
					name: '',
					description: null,
					contact: [],
					urls: ['https://other'],
					version: 'different',
					pubkey: 'different',
					time: 1,
					mint_ttl: 10,
					melt_ttl: 20,
					nuts: {'4': {methods: []}, '5': {methods: []}},
				},
			),
		).toEqual([]);
	});

	it('compares all six metadata fields and the disabled flags, treating an absent flag as enabled', () => {
		const result = differences(
			{},
			{
				name: 'n',
				description: 'd',
				description_long: 'long',
				motd: 'm',
				icon_url: 'i',
				contact: [{method: 'email', info: 'mint@example.com'}],
				nuts: {'4': {disabled: false}, '5': {disabled: true}},
			},
		);
		expect(result.map(({group, setting, nut}) => ({group, setting, nut}))).toEqual([
			...['name', 'description', 'description_long', 'motd', 'icon_url', 'contact'].map((setting) => ({
				group: 'info',
				setting,
				nut: null,
			})),
			{group: 'config', setting: 'disabled', nut: 5},
		]);
		expect(result.at(-1)).toMatchObject({this_member_value: 'false', their_value: 'true'});
	});

	it('ignores ordering of contacts, methods and options object keys', () => {
		const first = {method: 'bolt11', unit: 'sat', min_amount: 0, options: {description: false, nested: {a: 1, b: 2}}};
		const second = {method: 'onchain', unit: 'sat', options: {}};
		const contacts = [
			{method: 'email', info: 'mint@example.com'},
			{method: 'nostr', info: 'npub'},
		];
		expect(
			differences(
				{contact: contacts, nuts: {'4': {methods: [first, second]}}},
				{
					contact: [...contacts].reverse(),
					nuts: {
						'4': {
							methods: [
								{...second, options: undefined},
								{...first, options: {nested: {b: 2, a: 1}, description: false}},
							],
						},
					},
				},
			),
		).toEqual([]);
	});

	it('compares options and separates the same method in different units', () => {
		expect(
			differences(
				{nuts: {'5': {methods: [{method: 'bolt11', unit: 'sat', options: {amountless: true}}]}}},
				{
					nuts: {
						'5': {
							methods: [
								{method: 'bolt11', unit: 'sat', options: {amountless: false}},
								{method: 'bolt11', unit: 'msat'},
							],
						},
					},
				},
			),
		).toEqual([
			{
				group: 'config',
				setting: 'method',
				nut: 5,
				method: 'bolt11',
				unit: 'msat',
				this_member_value: 'false',
				their_value: 'true',
			},
			{
				group: 'config',
				setting: 'options',
				nut: 5,
				method: 'bolt11',
				unit: 'sat',
				this_member_value: '{"amountless":true}',
				their_value: '{"amountless":false}',
			},
		]);
	});

	it('keeps the digits of integers beyond the safe range', () => {
		expect(parseFederationPublicInfo('{"max_amount":9007199254740993,"options":0.5}')).toEqual({
			max_amount: '9007199254740993',
			options: 0.5,
		});
	});

	it.each([null, [], 'error'])('rejects malformed public info %s instead of showing a match', (value) => {
		expect(() => readFederationPublicSettings(value)).toThrow('Mint info must be a JSON object');
	});

	it('rejects duplicate method/unit identities instead of silently selecting one', () => {
		expect(() =>
			readFederationPublicSettings({
				nuts: {
					'4': {
						methods: [
							{method: 'bolt11', unit: 'sat'},
							{method: 'bolt11', unit: 'sat'},
						],
					},
				},
			}),
		).toThrow('Mint info nuts.4.methods lists bolt11 sat twice');
	});
});
