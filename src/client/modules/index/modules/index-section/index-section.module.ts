/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
/* Application Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Local Dependencies */
import {IndexSectionComponent} from './components/index-section/index-section.component';
/* Shared Dependencies */
import {AiAssistant} from '@shared/generated.types';

@NgModule({
	declarations: [IndexSectionComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: IndexSectionComponent,
				data: {
					section: 'index',
				},
				children: [
					{
						path: '',
						loadChildren: () =>
							import('@client/modules/index/modules/index-subsection-dashboard/index-subsection-dashboard.module').then(
								(m) => m.OrcIndexSubsectionDashboardModule,
							),
						title: 'Orchard',
						data: {
							section: 'index',
							sub_section: 'home',
						},
					},
					{
						path: 'crew',
						loadChildren: () =>
							import('@client/modules/index/modules/index-subsection-crew/index-subsection-crew.module').then(
								(m) => m.OrcIndexSubsectionCrewModule,
							),
						title: 'Orchard | Crew',
						data: {
							section: 'index',
							sub_section: 'crew',
							assistant: AiAssistant.IndexCrew,
						},
					},
					{
						path: 'system',
						loadChildren: () =>
							import('@client/modules/index/modules/index-subsection-system/index-subsection-system.module').then(
								(m) => m.OrcIndexSubsectionSystemModule,
							),
						title: 'Orchard | System',
						data: {
							section: 'index',
							sub_section: 'system',
							assistant: AiAssistant.System,
						},
					},
				],
			},
		]),
		CoreCommonModule,
		MatProgressSpinnerModule,
		OrcNavModule,
	],
	providers: [provideChartConfig()],
})
export class OrcIndexSectionModule {}
