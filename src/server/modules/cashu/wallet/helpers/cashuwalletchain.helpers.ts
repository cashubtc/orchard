/** An outpoint (txid:vout) as its parts, or null when it isn't one */
export const parseOutpoint = (outpoint: string): {txid: string; vout: number} | null => {
	const match = /^([0-9a-f]{64}):(\d+)$/i.exec(outpoint);
	return match ? {txid: match[1].toLowerCase(), vout: Number(match[2])} : null;
};
