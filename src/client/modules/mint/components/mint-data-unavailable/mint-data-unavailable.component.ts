/* Core Dependencies */
import {Component, ChangeDetectionStrategy, computed, inject} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
import {ConfigService} from '@client/modules/config/services/config.service';

@Component({
	selector: 'orc-mint-data-unavailable',
	imports: [RouterLink, MatIconModule, OrcPublicModule],
	templateUrl: './mint-data-unavailable.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintDataUnavailableComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly configService = inject(ConfigService);

	public readonly message = computed<string>(() => {
		const connection = this.query_params()?.get('connection');
		if (connection === 'public_api') return "This page needs the mint's public URL, which isn't configured.";
		if (connection === 'database') return 'This page needs a connected mint database.';
		if (connection === 'both') return 'This page needs a connected mint database and a configured public mint URL.';
		if (!this.configService.config.mint.database && !this.configService.config.mint.public_api)
			return "The mint database is unavailable and the mint's public URL isn't configured.";
		return !this.configService.config.mint.public_api ? "The mint's public URL isn't configured." : 'The mint database is unavailable.';
	});

	private readonly query_params = toSignal(this.route.queryParamMap);
}
