/* Native Dependencies */
import {MintUri} from '@client/modules/mint/types/mint-uri.types';

/**
 * A mint connection URL as a display object: its network type and a label with long onion hosts shortened
 * @param {string} url - The connection URL
 * @returns {MintUri} The URL, its origin, its type (tor, insecure or clearnet) and its label
 */
export function getMintUri(url: string): MintUri {
	const is_tor = url.includes('.onion');
	let label = url;
	let origin = url;
	try {
		const parsed = new URL(url);
		const host = parsed.hostname;
		label = is_tor ? `${host.split('.onion')[0].slice(0, 15)}...onion` : host;
		if (parsed.port) label += `:${parsed.port}`;
		origin = parsed.origin;
	} catch {
		label = is_tor ? `${url.split('.onion')[0].slice(0, 15)}...onion` : url;
	}
	const type = is_tor ? 'tor' : url.startsWith('http://') ? 'insecure' : 'clearnet';
	return {uri: url, origin, type, label};
}
