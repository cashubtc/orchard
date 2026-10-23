export type FederationMode = 'setup' | 'member' | 'standalone' | 'unreachable';

export interface FederationModeResult {
	mode: FederationMode;
	details: string | null;
}
