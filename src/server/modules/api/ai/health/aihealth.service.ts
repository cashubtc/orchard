/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Internal Dependencies */
import {OrchardAiHealth} from './aihealth.model.js';

@Injectable()
export class AiHealthService {
	private readonly logger = new Logger(AiHealthService.name);

	constructor(
		private fetchService: FetchService,
		private settingService: SettingService,
		private errorService: ErrorService,
	) {}

	/**
	 * Check AI vendor connectivity using saved settings
	 * @param {string} tag - Logging tag for error tracking
	 * @returns {Promise<OrchardAiHealth>} Health check result
	 */
	async checkHealth(tag: string): Promise<OrchardAiHealth> {
		try {
			const vendor = await this.settingService.getStringSetting(SettingKey.AI_VENDOR);
			if (!vendor) return new OrchardAiHealth({status: false, message: 'AI vendor is not configured', vendor: ''});
			if (vendor === 'openrouter') return await this.checkOpenRouter(vendor);
			return await this.checkOllama(vendor);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AiError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Test Ollama connectivity by fetching available models
	 * @param {string} vendor - The vendor name for the response
	 * @returns {Promise<OrchardAiHealth>} Health check result
	 */
	private async checkOllama(vendor: string): Promise<OrchardAiHealth> {
		const base_url = await this.settingService.getStringSetting(SettingKey.AI_OLLAMA_API);

		if (!base_url) {
			return new OrchardAiHealth({
				status: false,
				message: 'Ollama API endpoint is not configured',
				vendor,
			});
		}

		const response = await this.fetchService.fetchWithProxy(`${base_url}/api/tags`, {
			method: 'GET',
			headers: {'Content-Type': 'application/json'},
		});

		if (!response.ok) {
			return new OrchardAiHealth({
				status: false,
				message: `Ollama returned status ${response.status}`,
				vendor,
			});
		}

		return new OrchardAiHealth({status: true, message: null, vendor});
	}

	/**
	 * Test OpenRouter connectivity by validating the API key
	 * @param {string} vendor - The vendor name for the response
	 * @returns {Promise<OrchardAiHealth>} Health check result
	 */
	private async checkOpenRouter(vendor: string): Promise<OrchardAiHealth> {
		const api_key = await this.settingService.getStringSetting(SettingKey.AI_OPENROUTER_KEY);

		if (!api_key) {
			return new OrchardAiHealth({
				status: false,
				message: 'OpenRouter API key is not configured',
				vendor,
			});
		}

		const response = await this.fetchService.fetchWithProxy('https://openrouter.ai/api/v1/models', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${api_key}`,
			},
		});

		if (!response.ok) {
			return new OrchardAiHealth({
				status: false,
				message: `OpenRouter returned status ${response.status}`,
				vendor,
			});
		}

		return new OrchardAiHealth({status: true, message: null, vendor});
	}
}
