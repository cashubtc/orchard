/* Core Dependencies */
import {promises as dns} from 'dns';
import {URL} from 'url';
import * as net from 'net';

/**
 * RFC 1918, loopback, link-local, and cloud metadata IP ranges
 * that must never be probed by agent-initiated requests (SSRF prevention).
 */
const BLOCKED_CIDRS: {network: bigint; mask: bigint}[] = [
	/* 10.0.0.0/8        — RFC 1918 */
	parseCidr('10.0.0.0/8'),
	/* 172.16.0.0/12     — RFC 1918 */
	parseCidr('172.16.0.0/12'),
	/* 192.168.0.0/16    — RFC 1918 */
	parseCidr('192.168.0.0/16'),
	/* 127.0.0.0/8       — Loopback */
	parseCidr('127.0.0.0/8'),
	/* 169.254.0.0/16    — Link-local / cloud metadata */
	parseCidr('169.254.0.0/16'),
	/* 0.0.0.0/8         — "This" network */
	parseCidr('0.0.0.0/8'),
	/* 100.64.0.0/10     — Carrier-grade NAT (RFC 6598) */
	parseCidr('100.64.0.0/10'),
	/* 192.0.0.0/24      — IETF protocol assignments */
	parseCidr('192.0.0.0/24'),
	/* 198.18.0.0/15     — Benchmarking (RFC 2544) */
	parseCidr('198.18.0.0/15'),
	/* ::/128            — IPv6 unspecified */
	parseCidr6('::/128'),
	/* ::1/128           — IPv6 loopback */
	parseCidr6('::1/128'),
	/* fc00::/7          — IPv6 unique local */
	parseCidr6('fc00::/7'),
	/* fe80::/10         — IPv6 link-local */
	parseCidr6('fe80::/10'),
	/* ::ffff:0:0/96     — IPv4-mapped IPv6 */
	parseCidr6('::ffff:0:0/96'),
];

/** Blocked hostnames that resolve to metadata endpoints */
const BLOCKED_HOSTNAMES = new Set(['metadata.google.internal', 'metadata.google.com', 'instance-data']);

/** Parses an IPv4 CIDR into a network/mask pair as bigints */
function parseCidr(cidr: string): {network: bigint; mask: bigint} {
	const [ip_str, prefix_str] = cidr.split('/');
	const prefix = parseInt(prefix_str, 10);
	const parts = ip_str.split('.').map(Number);
	const ip = BigInt((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]);
	const mask = prefix === 0 ? 0n : ((1n << 32n) - 1n) << BigInt(32 - prefix);
	return {network: ip & mask, mask};
}

/** Parses an IPv6 CIDR into a network/mask pair as 128-bit bigints */
function parseCidr6(cidr: string): {network: bigint; mask: bigint} {
	const [ip_str, prefix_str] = cidr.split('/');
	const prefix = parseInt(prefix_str, 10);
	const ip = ipv6ToBigInt(ip_str);
	const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) << BigInt(128 - prefix);
	return {network: ip & mask, mask};
}

/** Converts an IPv6 address string to a 128-bit bigint */
function ipv6ToBigInt(ip: string): bigint {
	const expanded = expandIPv6(ip);
	const parts = expanded.split(':');
	let result = 0n;
	for (const part of parts) {
		result = (result << 16n) | BigInt(parseInt(part, 16));
	}
	return result;
}

/** Expands a shorthand IPv6 address to its full 8-group form */
function expandIPv6(ip: string): string {
	/* Handle IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) */
	const v4_match = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
	if (v4_match) {
		const parts = v4_match[1].split('.').map(Number);
		const hex1 = ((parts[0] << 8) | parts[1]).toString(16);
		const hex2 = ((parts[2] << 8) | parts[3]).toString(16);
		ip = ip.replace(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i, `::ffff:${hex1}:${hex2}`);
	}

	if (ip.includes('::')) {
		const sides = ip.split('::');
		const left = sides[0] ? sides[0].split(':') : [];
		const right = sides[1] ? sides[1].split(':') : [];
		const missing = 8 - left.length - right.length;
		const middle = Array(missing).fill('0');
		return [...left, ...middle, ...right].map((g) => g.padStart(4, '0')).join(':');
	}
	return ip
		.split(':')
		.map((g) => g.padStart(4, '0'))
		.join(':');
}

/** Converts an IPv4 string to a bigint */
function ipv4ToBigInt(ip: string): bigint {
	const parts = ip.split('.').map(Number);
	return BigInt((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]);
}

/** Checks whether the given IP (v4 or v6) falls within any blocked CIDR range */
function isBlockedIp(ip: string): boolean {
	const is_v6 = ip.includes(':');
	const value = is_v6 ? ipv6ToBigInt(ip) : ipv4ToBigInt(ip);

	for (const {network, mask} of BLOCKED_CIDRS) {
		if ((value & mask) === network) {
			return true;
		}
	}
	return false;
}

/**
 * Resolves a hostname to its IP addresses and validates that none
 * fall within blocked private/internal ranges. Returns the resolved
 * IP address on success.
 *
 * @throws Error if the hostname resolves to a blocked IP range
 */
export async function assertPublicHost(host: string): Promise<string | null> {
	/* Block known metadata hostnames */
	const lower = host.toLowerCase();
	if (BLOCKED_HOSTNAMES.has(lower)) {
		throw new Error(`Blocked: hostname '${host}' is not allowed`);
	}

	/* If the host is already an IP, check it directly */
	if (net.isIP(host)) {
		if (isBlockedIp(host)) {
			throw new Error(`Blocked: IP '${host}' is in a private/reserved range`);
		}
		return host;
	}

	/* Skip DNS resolution for .onion (resolved via Tor) */
	if (host.endsWith('.onion')) {
		return null;
	}

	/* Resolve DNS and check all returned addresses */
	let addresses: string[];
	try {
		addresses = await dns.resolve4(host);
	} catch {
		try {
			addresses = await dns.resolve6(host);
		} catch {
			return null;
		}
	}

	for (const addr of addresses) {
		if (isBlockedIp(addr)) {
			throw new Error(`Blocked: '${host}' resolves to private/reserved IP '${addr}'`);
		}
	}

	return addresses[0] ?? null;
}

/**
 * Extracts the hostname from a URL string and validates it via assertPublicHost.
 * Returns the resolved IP address on success.
 *
 * @throws Error if the URL is invalid or resolves to a blocked range
 */
export async function assertPublicUrl(url: string): Promise<string | null> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`Invalid URL: '${url}'`);
	}

	/* Only allow HTTP(S) schemes */
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(`Blocked: scheme '${parsed.protocol}' is not allowed`);
	}

	return await assertPublicHost(parsed.hostname);
}
