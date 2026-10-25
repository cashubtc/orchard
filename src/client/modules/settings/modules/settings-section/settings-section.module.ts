/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSidenavModule} from '@angular/material/sidenav';
/* Application Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
/* Local Dependencies */
import {SettingsSectionComponent} from './components/settings-section/settings-section.component';

@NgModule({
	declarations: [SettingsSectionComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: SettingsSectionComponent,
				data: {
					section: 'settings',
				},
				children: [
					{
						path: 'services',
						loadComponent: () =>
							import('@client/modules/service-config/components/settings-services/settings-services.component').then(
								(m) => m.SettingsServicesComponent,
							),
						title: 'Orchard | Services',
						data: {section: 'settings', sub_section: 'services'},
					},
					{
						path: '',
						redirectTo: 'app',
						pathMatch: 'full',
					},
					{
						path: 'app',
						loadChildren: () =>
							import('@client/modules/settings/modules/settings-subsection-app/settings-subsection-app.module').then(
								(m) => m.OrcSettingsSubsectionAppModule,
							),
						title: 'Orchard | App Settings',
						data: {
							section: 'settings',
							sub_section: 'app',
						},
					},
					{
						path: 'device',
						loadChildren: () =>
							import('@client/modules/settings/modules/settings-subsection-device/settings-subsection-device.module').then(
								(m) => m.OrcSettingsSubsectionDeviceModule,
							),
						title: 'Orchard | Device Settings',
						data: {
							section: 'settings',
							sub_section: 'device',
						},
					},
					{
						path: 'user',
						loadChildren: () =>
							import('@client/modules/settings/modules/settings-subsection-user/settings-subsection-user.module').then(
								(m) => m.OrcSettingsSubsectionUserModule,
							),
						title: 'Orchard | User Settings',
						data: {
							section: 'settings',
							sub_section: 'user',
						},
					},
				],
			},
		]),
		CoreCommonModule,
		MatProgressSpinnerModule,
		MatSidenavModule,
		OrcNavModule,
	],
})
export class OrcSettingsSectionModule {}
