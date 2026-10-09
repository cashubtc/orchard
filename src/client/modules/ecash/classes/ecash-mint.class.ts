/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Shared Dependencies */
import {OrchardEcashMint, OrchardNut4Method} from '@shared/generated.types';

/** Issuing always takes a bolt11 quote, matching the server's issue saga */
const ISSUE_METHOD = 'bolt11';

export class EcashMint implements OrchardEcashMint {
	id: string;
	urls: string[];
	is_orchard: boolean;
	created_at: number;
	info: MintInfo | null;

	/** The host of the mint's first url, port included */
	public get host(): string {
		const url = this.urls[0] ?? '';
		try {
			return new URL(url).host;
		} catch {
			return url;
		}
	}

	/** The mint's own name, falling back to its host */
	public get display_name(): string {
		return this.info?.name ?? this.host;
	}

	/** The mint's icon, from its info */
	public get icon_url(): string | null {
		return this.info?.icon_url ?? null;
	}

	/** Every unit the mint offers, from its minting methods */
	public get units(): string[] {
		return [...new Set((this.info?.nuts.nut4.methods ?? []).map((method) => method.unit))];
	}

	/** The minting methods issuing can use; none until info is fetched or while the mint has minting disabled */
	public get issue_methods(): OrchardNut4Method[] {
		const nut4 = this.info?.nuts.nut4;
		if (!nut4 || nut4.disabled) return [];
		return nut4.methods.filter((method) => method.method === ISSUE_METHOD);
	}

	/** Units ecash can be issued in */
	public get issue_units(): string[] {
		return [...new Set(this.issue_methods.map((method) => method.unit))];
	}

	/** Why ecash can't be issued from this mint right now, per its NUT-04 settings; null when it can */
	public get issue_blocked(): string | null {
		if (!this.info) return "Waiting for your mint's info";
		if (this.info.nuts.nut4.disabled) return 'Minting is disabled on your mint';
		if (this.issue_methods.length === 0) return 'Your mint offers no Lightning minting';
		return null;
	}

	/** The issuing method for a unit, carrying the mint's limits */
	public getIssueMethod(unit: string): OrchardNut4Method | null {
		return this.issue_methods.find((method) => method.unit === unit) ?? null;
	}

	constructor(oem: OrchardEcashMint) {
		this.id = oem.id;
		this.urls = oem.urls;
		this.is_orchard = oem.is_orchard;
		this.created_at = oem.created_at;
		this.info = oem.info ? new MintInfo(oem.info) : null;
	}
}
