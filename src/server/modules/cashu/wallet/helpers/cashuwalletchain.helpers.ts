/** An outpoint (txid:vout) as its parts, or null when it isn't one */
export function parseOutpoint(outpoint: string): {txid: string; vout: number} | null {
	const match = /^([0-9a-f]{64}):(\d+)$/i.exec(outpoint);
	return match ? {txid: match[1].toLowerCase(), vout: Number(match[2])} : null;
}

/** Confirmations of a transaction in the block at a height, with the chain's tip at another: 1 in the tip itself */
export function chainConfirmations(tip: number, height: number): number {
	return tip - height + 1;
}
