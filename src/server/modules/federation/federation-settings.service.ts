/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Vendor Dependencies */
import {DateTime} from 'luxon';

/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';

/* Native Dependencies */
import {FederationService} from '#server/modules/federation/federation.service';
import {FederationSettingsComparisonStatus} from '#server/modules/federation/federation-settings.enums';
import {
	FEDERATION_SETTINGS_CACHE_MS,
	FEDERATION_SETTINGS_ERROR_LENGTH,
	FEDERATION_SETTINGS_FETCH_TIMEOUT_MS,
} from '#server/modules/federation/constants/federation.constants';
import {
	compareFederationPublicSettings,
	parseFederationPublicInfo,
	readFederationPublicSettings,
} from '#server/modules/federation/helpers/federation-settings.helpers';
import type {FederationSettingsComparison, FederationMemberSettingsRead} from '#server/modules/federation/federation-settings.types';

type FederationInfo = Awaited<ReturnType<FederationService['getInfo']>>;

@Injectable()
export class FederationSettingsService {
	private cache: {key: string; expires_at: number; value: FederationSettingsComparison} | null = null;
	private pending: {key: string; promise: Promise<FederationSettingsComparison>} | null = null;

	constructor(
		private readonly federationService: FederationService,
		private readonly fetchService: FetchService,
		private readonly configService: ConfigService,
	) {}

	/** Reuse a recent comparison for the same mint connection; a refresh always reads again. */
	public async getComparison(refresh: boolean = false): Promise<FederationSettingsComparison> {
		const key = this.connectionKey();
		if (!refresh && this.cache?.key === key && this.cache.expires_at > Date.now()) return this.cache.value;
		if (!refresh && this.pending?.key === key) return this.pending.promise;
		const pending = {key, promise: this.compareMembers()};
		this.pending = pending;
		try {
			const value = await pending.promise;
			if (this.pending === pending) this.cache = {key, expires_at: Date.now() + FEDERATION_SETTINGS_CACHE_MS, value};
			return value;
		} finally {
			if (this.pending === pending) this.pending = null;
		}
	}

	/** Identify the mint connection and proxy by non-secret values, so a switch starts a fresh comparison. */
	private connectionKey(): string {
		return JSON.stringify([
			this.configService.get('cashu.rpc_host'),
			this.configService.get('cashu.rpc_port'),
			this.configService.get('cashu.api'),
			this.configService.get('server.proxy'),
		]);
	}

	/** Fetch every member together and compare against the local member's public settings. */
	private async compareMembers(): Promise<FederationSettingsComparison> {
		const info: FederationInfo = await this.federationService.getInfo();
		const reads = await Promise.all(info.members.map((member) => this.readMember(member.public_mint_url)));
		const baseline = reads[info.members.findIndex((member) => member.member_id === info.local_member_id)]?.settings ?? null;
		return {
			federation_id: info.federation_id,
			local_member_id: info.local_member_id,
			// cdk wallets create quotes at the lowest member slot unless configured otherwise
			default_quote_member_id: Math.min(...info.members.map((member) => member.member_id)),
			checked_at: DateTime.now().toUnixInteger(),
			baseline_available: baseline !== null,
			members: info.members.map((member, index) => {
				const read = reads[index];
				const differences = baseline && read.settings ? compareFederationPublicSettings(baseline, read.settings) : [];
				const status =
					read.status ??
					(!baseline
						? FederationSettingsComparisonStatus.not_comparable
						: differences.length
							? FederationSettingsComparisonStatus.differs
							: FederationSettingsComparisonStatus.matches);
				return {
					member_id: member.member_id,
					local: member.member_id === info.local_member_id,
					public_mint_url: member.public_mint_url,
					federation_api_url: member.federation_api_url,
					status,
					error: read.error,
					differences,
				};
			}),
		};
	}

	/** Read one member's public info over HTTP(S); other transports can't be fetched from Orchard. */
	private async readMember(public_mint_url: string): Promise<FederationMemberSettingsRead> {
		const url = URL.canParse(public_mint_url) ? new URL(public_mint_url) : null;
		if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:'))
			return {settings: null, status: FederationSettingsComparisonStatus.not_comparable, error: "Can't be compared from Orchard"};
		url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/info`;
		url.hash = '';
		const unavailable = FederationSettingsComparisonStatus.unavailable;
		try {
			const response = await this.fetchService.fetchWithProxy(url.toString(), {
				method: 'GET',
				signal: AbortSignal.timeout(FEDERATION_SETTINGS_FETCH_TIMEOUT_MS),
			});
			const body = await response.text();
			if (!response.ok) return {settings: null, status: unavailable, error: this.httpError(body, response)};
			return {settings: readFederationPublicSettings(parseFederationPublicInfo(body)), status: null, error: null};
		} catch (error) {
			return {settings: null, status: unavailable, error: error instanceof Error ? error.message : String(error)};
		}
	}

	/** Relay the member's own error message, or a short excerpt of its response body. */
	private httpError(body: string, response: {status: number; statusText: string}): string {
		const status = `${response.status} ${response.statusText}`.trim();
		let message = body;
		try {
			const parsed: unknown = JSON.parse(body);
			const fields = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
			message = [parsed, fields.detail, fields.error, fields.message].find((value) => typeof value === 'string') ?? body;
		} catch {}
		const excerpt = message.replace(/\s+/g, ' ').trim().slice(0, FEDERATION_SETTINGS_ERROR_LENGTH);
		return excerpt ? `${status}: ${excerpt}` : status;
	}
}
