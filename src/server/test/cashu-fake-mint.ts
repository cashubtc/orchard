/* Vendor Dependencies */
import {
	JSONInt,
	MintOperationError,
	createBlindSignature,
	createNewMintKeys,
	hashToCurve,
	pointFromHex,
	serializeMintKeys,
	verifyMintQuoteSignature,
	verifyUnblindedSignature,
	type RequestFn,
	type RequestOptions,
} from '@cashu/cashu-ts';

type FakeMintOptions = {
	pubkey?: string;
	urls?: string[];
	input_fee_ppk?: number;
	version_byte?: number;
};

/** Y of a proof secret, which mints key spent state by (NUT-07) */
const toY = (secret: string): string => hashToCurve(new TextEncoder().encode(secret)).toHex(true);

/** Mint that signs, verifies and spends with cashu-ts crypto, with scriptable failures, outages and lost responses */
export const createFakeMint = ({pubkey = '02orchard', urls = [], input_fee_ppk = 0, version_byte}: FakeMintOptions = {}) => {
	const newKeyset = () => createNewMintKeys(8, undefined, {unit: 'sat', input_fee_ppk, versionByte: version_byte});
	const keysets = [newKeyset()];
	const signed = new Map<string, {id: string; amount: number; C_: string}>();
	const spent = new Set<string>();
	const quotes = new Map<string, {pubkey?: string; state: string; amount: number; expiry: number | null}>();
	const failures: {code: number; detail: string}[] = [];
	const outages = new Map<string, number>();
	const lost = new Set<string>();
	const info = {
		name: 'Orchard Test Mint',
		pubkey,
		version: 'cdk',
		contact: [],
		urls,
		nuts: {
			4: {methods: [{method: 'bolt11', unit: 'sat'}], disabled: false},
			5: {methods: [], disabled: false},
			7: {supported: true},
			9: {supported: true},
			20: {supported: true},
		},
	};
	const active = () => keysets[keysets.length - 1];
	const findKeyset = (id: string) => keysets.find((keyset) => keyset.keysetId === id);
	const describeKeyset = (keyset: (typeof keysets)[number]) => ({
		id: keyset.keysetId,
		unit: 'sat',
		active: keyset === active(),
		input_fee_ppk,
	});
	const sign = (output: {amount: number; id: string; B_: string}) => {
		const signature = createBlindSignature(pointFromHex(output.B_), findKeyset(output.id)!.privKeys[output.amount], output.id);
		const result = {id: output.id, amount: Number(output.amount), C_: signature.C_.toHex(true)};
		signed.set(output.B_, result);
		return result;
	};
	const total = (items: {amount: number}[]) => items.reduce((sum, item) => sum + Number(item.amount), 0);
	const quoteResponse = (id: string) => {
		const quote = quotes.get(id)!;
		return {quote: id, request: `lnbc${quote.amount * 10}n1fake`, unit: 'sat', ...quote};
	};
	const mintOutputs = (body: any): [number, any] => {
		const quote = quotes.get(body.quote);
		if (quote?.state === 'UNPAID') return [400, {code: 20001, detail: 'Quote not paid'}];
		if (quote?.state === 'ISSUED') return [400, {code: 20002, detail: 'Quote already issued'}];
		if (quote?.pubkey && !verifyMintQuoteSignature(quote.pubkey, body.quote, body.outputs, body.signature ?? '')) {
			return [400, {code: 20008, detail: 'Invalid signature'}];
		}
		if (body.outputs.some((output: any) => signed.has(output.B_))) return [400, {code: 11003, detail: 'Outputs already signed'}];
		const signatures = body.outputs.map(sign);
		if (quote) quote.state = 'ISSUED';
		return [200, {signatures}];
	};
	const swap = (body: any): [number, any] => {
		const verified = body.inputs.every((input: any) => {
			const privkey = findKeyset(input.id)?.privKeys[input.amount];
			const secret = new TextEncoder().encode(input.secret);
			return !!privkey && verifyUnblindedSignature({C: pointFromHex(input.C), secret, id: input.id}, privkey);
		});
		if (!verified) return [400, {code: 10001, detail: 'Proof verification failed'}];
		if (body.inputs.some((input: any) => spent.has(toY(input.secret)))) return [400, {code: 11001, detail: 'Token already spent'}];
		if (body.outputs.some((output: any) => signed.has(output.B_))) return [400, {code: 11003, detail: 'Outputs already signed'}];
		const fee = Math.ceil((body.inputs.length * input_fee_ppk) / 1000);
		if (total(body.inputs) - fee !== total(body.outputs)) return [400, {code: 11005, detail: 'Transaction is not balanced'}];
		body.inputs.forEach((input: any) => spent.add(toY(input.secret)));
		return [200, {signatures: body.outputs.map(sign)}];
	};
	const route = (path: string, body: any): [number, any] => {
		const outage = outages.get(path);
		if (outage) return [outage, {detail: 'Unavailable'}];
		if (path === '/v1/info') return [200, info];
		if (path === '/v1/keysets') return [200, {keysets: keysets.map(describeKeyset)}];
		if (path.startsWith('/v1/keys')) {
			const requested = keysets.filter((keyset) => path === '/v1/keys' || path.endsWith(`/${keyset.keysetId}`));
			return [200, {keysets: requested.map((keyset) => ({...describeKeyset(keyset), keys: serializeMintKeys(keyset.pubKeys)}))}];
		}
		if (path === '/v1/mint/quote/bolt11') {
			const quote = `quote-${quotes.size + 1}`;
			quotes.set(quote, {pubkey: body.pubkey, state: 'UNPAID', amount: body.amount, expiry: null});
			return [200, quoteResponse(quote)];
		}
		if (path.startsWith('/v1/mint/quote/bolt11/')) {
			const quote = path.split('/').pop()!;
			return quotes.has(quote) ? [200, quoteResponse(quote)] : [400, {code: 20004, detail: 'Unknown quote'}];
		}
		if (path === '/v1/mint/bolt11' || path === '/v1/swap') {
			const failure = failures.shift();
			if (failure) return [400, failure];
			return path === '/v1/swap' ? swap(body) : mintOutputs(body);
		}
		if (path === '/v1/checkstate') {
			return [200, {states: body.Ys.map((Y: string) => ({Y, state: spent.has(Y) ? 'SPENT' : 'UNSPENT', witness: null}))}];
		}
		if (path === '/v1/restore') {
			const outputs = body.outputs.filter((output: any) => signed.has(output.B_));
			return [200, {outputs, signatures: outputs.map((output: any) => signed.get(output.B_))}];
		}
		return [404, {detail: 'not found'}];
	};
	const handle = (path: string, body: any): [number, any] => {
		const response = route(path, body);
		return lost.delete(path) ? [504, {detail: 'Gateway timeout'}] : response;
	};
	/** Activate a new keyset, leaving the earlier ones inactive */
	const rotate = () => void keysets.push(newKeyset());
	return {
		get keyset() {
			return active();
		},
		info,
		quotes,
		failures,
		outages,
		lost,
		handle,
		rotate,
	};
};

export type FakeMint = ReturnType<typeof createFakeMint>;

/** FetchService.fetchWithProxy answered by the fake mint at each URL's origin; offline fails like an unreachable mint */
export const fakeMintFetch =
	(mintAt: (origin: string) => FakeMint, offline: () => boolean = () => false) =>
	async (url: string, options: {body?: string}) => {
		if (offline()) throw new Error('socket hang up');
		const {origin, pathname} = new URL(url);
		const [status, body] = mintAt(origin).handle(pathname, options.body ? JSON.parse(options.body) : undefined);
		return {ok: status < 300, status, text: async () => JSON.stringify(body), headers: {get: () => null}};
	};

/** cashu-ts transport straight onto a fake mint, for wallets built outside Orchard */
export const fakeMintRequest =
	(mint: FakeMint): RequestFn =>
	async <T>({endpoint, requestBody}: RequestOptions): Promise<T> => {
		const [status, body] = mint.handle(
			new URL(endpoint).pathname,
			requestBody ? JSON.parse(JSONInt.stringify(requestBody)) : undefined,
		);
		if (status >= 300) throw new MintOperationError(body.code, body.detail);
		return body as T;
	};
