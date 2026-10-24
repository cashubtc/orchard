import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, RouterOutlet} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {of} from 'rxjs';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {federationMemberGuard} from './federation-member.guard';

@Component({imports: [RouterOutlet], template: '<router-outlet></router-outlet>'})
class MintShell {}
@Component({template: 'Member dashboard'})
class MemberPage {}
@Component({template: 'Setup wizard'})
class SetupPage {}

describe('federationMemberGuard', () => {
	for (const mode of ['member', 'setup', 'unreachable'])
		it(`opens the ${mode === 'member' ? 'member dashboard' : 'setup wizard'} for ${mode}`, async () => {
			TestBed.configureTestingModule({
				providers: [
					{provide: FederationService, useValue: {loadMode: () => of({mode})}},
					provideRouter([
						{
							path: 'mint',
							children: [
								{
									path: '',
									component: MintShell,
									children: [{path: 'federation', canMatch: [federationMemberGuard], component: MemberPage}],
								},
								{path: 'federation', component: SetupPage},
							],
						},
					]),
				],
			});
			const harness = await RouterTestingHarness.create();
			await harness.navigateByUrl('/mint/federation');
			expect(harness.routeNativeElement?.textContent).toContain(mode === 'member' ? 'Member dashboard' : 'Setup wizard');
		});
});
