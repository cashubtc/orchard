/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {assertPublicHost, assertPublicUrl} from './network-guard.js';

describe('network-guard', () => {
	describe('assertPublicUrl', () => {
		it('rejects non-HTTP schemes', async () => {
			await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow('scheme');
			await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('scheme');
		});

		it('rejects invalid URLs', async () => {
			await expect(assertPublicUrl('not-a-url')).rejects.toThrow('Invalid URL');
		});

		it('rejects URLs pointing to localhost', async () => {
			await expect(assertPublicUrl('http://127.0.0.1/latest')).rejects.toThrow('private/reserved');
		});

		it('rejects URLs pointing to link-local metadata endpoint', async () => {
			await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('private/reserved');
		});

		it('rejects URLs pointing to RFC 1918 ranges', async () => {
			await expect(assertPublicUrl('http://10.0.0.1/')).rejects.toThrow('private/reserved');
			await expect(assertPublicUrl('http://172.16.0.1/')).rejects.toThrow('private/reserved');
			await expect(assertPublicUrl('http://192.168.1.1/')).rejects.toThrow('private/reserved');
		});

		it('rejects blocked metadata hostnames', async () => {
			await expect(assertPublicUrl('http://metadata.google.internal/')).rejects.toThrow('not allowed');
		});

		it('rejects 0.0.0.0', async () => {
			await expect(assertPublicUrl('http://0.0.0.0/')).rejects.toThrow('private/reserved');
		});
	});

	describe('assertPublicHost', () => {
		it('rejects loopback IPs', async () => {
			await expect(assertPublicHost('127.0.0.1')).rejects.toThrow('private/reserved');
			await expect(assertPublicHost('127.255.255.255')).rejects.toThrow('private/reserved');
		});

		it('rejects RFC 1918 IPs', async () => {
			await expect(assertPublicHost('10.0.0.1')).rejects.toThrow('private/reserved');
			await expect(assertPublicHost('172.16.0.1')).rejects.toThrow('private/reserved');
			await expect(assertPublicHost('192.168.0.1')).rejects.toThrow('private/reserved');
		});

		it('rejects link-local IPs', async () => {
			await expect(assertPublicHost('169.254.169.254')).rejects.toThrow('private/reserved');
		});

		it('rejects carrier-grade NAT range', async () => {
			await expect(assertPublicHost('100.64.0.1')).rejects.toThrow('private/reserved');
		});

		it('rejects IPv6 loopback', async () => {
			await expect(assertPublicHost('::1')).rejects.toThrow('private/reserved');
		});

		it('rejects IPv6 unique local', async () => {
			await expect(assertPublicHost('fd00::1')).rejects.toThrow('private/reserved');
		});

		it('rejects IPv6 link-local', async () => {
			await expect(assertPublicHost('fe80::1')).rejects.toThrow('private/reserved');
		});

		it('skips validation for .onion hosts', async () => {
			const result = await assertPublicHost('myservice.onion');
			expect(result).toBeNull();
		});

		it('rejects blocked metadata hostnames', async () => {
			await expect(assertPublicHost('metadata.google.internal')).rejects.toThrow('not allowed');
		});
	});
});
