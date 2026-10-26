/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
/* Vendor Dependencies */
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
/* Application Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {OrcAiModule} from '@client/modules/ai/ai.module';
import {OrcLayoutModule} from '@client/modules/layout/layout.module';
import {OrcEventGeneralModule} from '@client/modules/event/modules/event-general/event-general.module';
import {authenticationGuard} from '@client/modules/auth/guards/authentication/authentication.guard';
import {initializationGuard} from '@client/modules/auth/guards/initialization/initialization.guard';
import {serviceStatusGuard} from '@client/modules/routing/guards/service-status/service-status.guard';
import {LayoutInteriorComponent} from '@client/modules/layout/components/layout-interior/layout-interior.component';
import {LayoutExteriorComponent} from '@client/modules/layout/components/layout-exterior/layout-exterior.component';
/* Native Dependencies */
import {SectionPreloadStrategy} from './strategy/section-preload.strategy';

const interior_routes = [
	{
		path: '',
		loadChildren: () => import('@client/modules/index/modules/index-section/index-section.module').then((m) => m.OrcIndexSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'bitcoin',
		loadChildren: () =>
			import('@client/modules/bitcoin/modules/bitcoin-section/bitcoin-section.module').then((m) => m.OrcBitcoinSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'lightning',
		loadChildren: () =>
			import('@client/modules/lightning/modules/lightning-section/lightning-section.module').then((m) => m.OrcLightningSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'mint',
		loadChildren: () => import('@client/modules/mint/modules/mint-section/mint-section.module').then((m) => m.OrcMintSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'ecash',
		loadChildren: () => import('@client/modules/ecash/modules/ecash-section/ecash-section.module').then((m) => m.OrcEcashSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'settings',
		loadChildren: () =>
			import('@client/modules/settings/modules/settings-section/settings-section.module').then((m) => m.OrcSettingsSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
	{
		path: 'event',
		loadChildren: () => import('@client/modules/event/modules/event-section/event-section.module').then((m) => m.OrcEventSectionModule),
		canActivateChild: [initializationGuard, authenticationGuard],
	},
];

const routes: Routes = [
	{
		path: 'onboarding',
		component: LayoutExteriorComponent,
		canActivate: [initializationGuard, authenticationGuard],
		loadChildren: () => import('@client/modules/onboarding/onboarding.module').then((m) => m.OrcOnboardingModule),
	},
	{
		path: '',
		component: LayoutInteriorComponent,
		canMatch: [serviceStatusGuard],
		canActivate: [initializationGuard, authenticationGuard],
		canActivateChild: [initializationGuard, authenticationGuard],
		children: interior_routes,
	},
	{
		path: 'auth',
		component: LayoutExteriorComponent,
		loadChildren: () => import('@client/modules/auth/modules/auth-section/auth-section.module').then((m) => m.OrcAuthSectionModule),
	},
];

@NgModule({
	imports: [
		RouterModule.forRoot(routes, {
			preloadingStrategy: SectionPreloadStrategy,
		}),
		MatSidenavModule,
		MatProgressSpinnerModule,
		OrcNavModule,
		OrcAiModule,
		OrcLayoutModule,
		OrcEventGeneralModule,
	],
	exports: [RouterModule],
	declarations: [],
})
export class OrcRoutingModule {}
