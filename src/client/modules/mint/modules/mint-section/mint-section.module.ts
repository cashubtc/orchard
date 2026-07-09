/* Core Dependencies */
import {NgModule, inject} from '@angular/core';
import {RouterModule as CoreRouterModule, Router, ResolveFn, ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
/* Vendor Dependencies */
import {catchError, of} from 'rxjs';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
/* Application Dependencies */
import {errorResolveGuard} from '@client/modules/error/guards/error-resolve.guard';
import {enabledGuard} from '@client/modules/routing/guards/enabled/enabled.guard';
import {ErrorService} from '@client/modules/error/services/error.service';
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
/* Local Dependencies */
import {MintSectionComponent} from './components/mint-section/mint-section.component';
/* Shared Dependencies */
import {AiAssistant} from '@shared/generated.types';

const mintInfoResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.loadMintInfo().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintBalancesResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.loadMintBalances().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintKeysetsResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.loadMintKeysets().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintKeysetCountsResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.loadMintKeysetCounts({}).pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintDatabaseInfoResolver: ResolveFn<any> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	return mintService.loadMintDatabaseInfo().pipe(
		catchError(() => {
			return of(null);
		}),
	);
};

const mintInfoRpcResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.getMintInfo().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintMetricsSnapshotResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.getMintMetricsSnapshot().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

const mintQuoteTtlsResolver: ResolveFn<any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const mintService = inject(MintService);
	const router = inject(Router);
	const errorService = inject(ErrorService);
	return mintService.getMintQuoteTtls().pipe(
		catchError((error) => {
			errorService.resolve_errors.push(error);
			router.navigate(['mint', 'error'], {state: {error, target: state.url, sub_section: route.data['sub_section']}});
			return of([]);
		}),
	);
};

@NgModule({
	declarations: [MintSectionComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSectionComponent,
				data: {
					section: 'mint',
				},
				children: [
					{
						path: '',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-dashboard/mint-subsection-dashboard.module').then(
								(m) => m.OrcMintSubsectionDashboardModule,
							),
						title: 'Orchard | Mint',
						resolve: {
							mint_info: mintInfoResolver,
							mint_balances: mintBalancesResolver,
							mint_keysets: mintKeysetsResolver,
							mint_keyset_counts: mintKeysetCountsResolver,
							mint_database_info: mintDatabaseInfoResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'dashboard',
							assistant: AiAssistant.MintDashboard,
						},
					},
					{
						path: 'info',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-info/mint-subsection-info.module').then(
								(m) => m.OrcMintSubsectionInfoModule,
							),
						title: 'Orchard | Mint Info',
						resolve: {
							mint_info_rpc: mintInfoRpcResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'info',
							assistant: AiAssistant.MintInfo,
						},
					},
					{
						path: 'config',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-config/mint-subsection-config.module').then(
								(m) => m.OrcMintSubsectionConfigModule,
							),
						title: 'Orchard | Mint Config',
						resolve: {
							mint_info: mintInfoResolver,
							mint_quote_ttl: mintQuoteTtlsResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'config',
							assistant: AiAssistant.MintConfig,
						},
					},
					{
						path: 'keysets',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-keysets/mint-subsection-keysets.module').then(
								(m) => m.OrcMintSubsectionKeysetsModule,
							),
						title: 'Orchard | Mint Keysets',
						resolve: {
							mint_keysets: mintKeysetsResolver,
							mint_keyset_counts: mintKeysetCountsResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'keysets',
							assistant: AiAssistant.MintKeysets,
						},
					},
					{
						path: 'database',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module').then(
								(m) => m.OrcMintSubsectionDatabaseModule,
							),
						title: 'Orchard | Mint Database',
						resolve: {
							mint_keysets: mintKeysetsResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'database',
							assistant: AiAssistant.MintDatabase,
						},
					},
					{
						path: 'server',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module').then(
								(m) => m.OrcMintSubsectionServerModule,
							),
						title: 'Orchard | Mint Server',
						resolve: {
							mint_metrics_snapshot: mintMetricsSnapshotResolver,
						},
						canActivate: [enabledGuard],
						data: {
							section: 'mint',
							sub_section: 'server',
							assistant: AiAssistant.MintServer,
						},
					},
					{
						path: 'error',
						loadChildren: () =>
							import('@client/modules/mint/modules/mint-subsection-error/mint-subsection-error.module').then(
								(m) => m.OrcMintSubsectionErrorModule,
							),
						title: 'Orchard | Mint Error',
						data: {
							section: 'mint',
							sub_section: 'error',
						},
						canActivate: [errorResolveGuard],
						resolve: {
							origin: () => {
								const router = inject(Router);
								const navigation = router.currentNavigation();
								return navigation?.extras?.state?.['sub_section'] || 'unknown';
							},
						},
					},
				],
			},
			{
				path: 'disabled',
				loadChildren: () =>
					import('@client/modules/mint/modules/mint-subsection-disabled/mint-subsection-disabled.module').then(
						(m) => m.OrcMintSubsectionDisabledModule,
					),
				title: 'Orchard | Mint Disabled',
				data: {
					section: 'mint',
					sub_section: 'disabled',
				},
			},
		]),
		MatProgressSpinnerModule,
		OrcNavModule,
		OrcMintGeneralModule,
	],
	providers: [provideChartConfig()],
})
export class OrcMintSectionModule {}
