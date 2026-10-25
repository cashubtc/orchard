/**
 * Compares bitcoin and lightning network identifiers
 * Bitcoin uses: "main", "test", "regtest", "signet"
 * Lightning uses: "mainnet", "testnet", "signet", "bitcoin" (CLN)
 */
export function bitcoinNetworksMatch(bitcoin_network: string, lightning_network: string | undefined): boolean {
	const network_map: Record<string, string[]> = {
		main: ['mainnet', 'bitcoin'],
		test: ['testnet'],
		regtest: ['regtest'],
		signet: ['signet'],
	};
	return !!lightning_network && (network_map[bitcoin_network]?.includes(lightning_network) ?? false);
}
