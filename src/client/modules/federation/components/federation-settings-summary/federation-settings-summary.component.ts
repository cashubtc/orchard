/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';

/* Application Dependencies */
import {OrcErrorModule} from '@client/modules/error/error.module';
import {OrcLocalModule} from '@client/modules/local/local.module';

/* Native Dependencies */
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {
	federationDefaultQuoteLimitsDiffer,
	federationSettingsSummary,
} from '@client/modules/federation/helpers/federation-settings.helpers';

/* Shared Dependencies */
import {FederationSettingsComparisonGroup} from '@shared/generated.types';

@Component({
	selector: 'orc-federation-settings-summary',
	imports: [MatButtonModule, OrcErrorModule, OrcLocalModule],
	templateUrl: './federation-settings-summary.component.html',
	styleUrl: './federation-settings-summary.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSettingsSummaryComponent {
	private readonly settings_service = inject(FederationSettingsService);

	public readonly group = input.required<`${FederationSettingsComparisonGroup}`>();

	public readonly comparison = this.settings_service.comparison;
	public readonly loading = this.settings_service.loading;
	public readonly error = this.settings_service.error;
	public readonly summary = computed(() => federationSettingsSummary(this.comparison(), this.group()));
	public readonly unchecked = computed(
		() => this.comparison()?.members.filter((member) => member.status !== 'matches' && member.status !== 'differs') ?? [],
	);
	public readonly default_quote_warning = computed(
		() => this.group() === FederationSettingsComparisonGroup.Config && federationDefaultQuoteLimitsDiffer(this.comparison()),
	);
	public readonly default_quote_member_id = computed(() => this.comparison()?.default_quote_member_id ?? 1);

	/* *******************************************************
		Actions
	******************************************************** */

	/** Compare again only when the operator asks. */
	public refresh(): void {
		this.settings_service.load(true);
	}
}
