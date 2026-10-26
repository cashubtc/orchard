/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';

/* Native Dependencies */
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {FEDERATION_SETTINGS_NUT_NUMBERS} from '@client/modules/federation/constants/federation-settings.constants';
import {federationSettingKey} from '@client/modules/federation/helpers/federation-settings.helpers';
import type {FederationSettingHint, FederationSettingsNut} from '@client/modules/federation/types/federation-settings.types';

const NO_HINTS: readonly FederationSettingHint[] = [];

@Component({
	selector: 'orc-federation-settings-hint',
	templateUrl: './federation-settings-hint.component.html',
	styleUrl: './federation-settings-hint.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSettingsHintComponent {
	private readonly settings_service = inject(FederationSettingsService);

	public readonly setting = input.required<string>();
	public readonly nut = input<FederationSettingsNut | null>(null);
	public readonly method = input<string | null>(null);
	public readonly unit = input<string | null>(null);
	public readonly show_field = input<boolean>(false);

	// Empty unless a member comparison has loaded, so standalone mints render nothing
	public readonly hints = computed(() => {
		const nut = this.nut();
		const key = federationSettingKey(this.setting(), nut ? FEDERATION_SETTINGS_NUT_NUMBERS[nut] : null, this.method(), this.unit());
		return this.settings_service.hints().get(key) ?? NO_HINTS;
	});
}
