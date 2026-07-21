/* Core Dependencies */
import {inject} from '@angular/core';
import {CanMatchFn} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Matches the mint system route only when the mint prometheus exporter is configured (MINT_METRICS_API) */
export const mintMetricsGuard: CanMatchFn = () => inject(ConfigService).config.mint.metrics;
