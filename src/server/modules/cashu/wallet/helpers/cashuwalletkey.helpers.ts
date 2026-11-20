/* Vendor Dependencies */
import {getKeysetIdInt} from '@cashu/cashu-ts';
import {HDKey} from '@scure/bip32';

/**
 * Counter cursor for a keyset's NUT-13 derivation path: version 01 ids derive from the whole id, legacy and version 00 ids
 * from their integer mod 2^31-1, so different ids that reduce alike share one cursor and never repeat a secret
 */
export function getCounterKey(keyset_id: string): string {
	return keyset_id.startsWith('01') ? keyset_id : getKeysetIdInt(keyset_id).toString();
}

/** NUT-20 mint quote locking keypair (hex) for a counter, derived from the wallet seed */
export function deriveMintQuoteKey(seed: Uint8Array, counter: number): {privkey: string; pubkey: string} {
	const node = HDKey.fromMasterSeed(seed).derive(`m/129373'/20'/0'/0'/${counter}`);
	if (!node.privateKey || !node.publicKey) throw new Error(`No mint quote key at counter ${counter}`);
	return {privkey: Buffer.from(node.privateKey).toString('hex'), pubkey: Buffer.from(node.publicKey).toString('hex')};
}
