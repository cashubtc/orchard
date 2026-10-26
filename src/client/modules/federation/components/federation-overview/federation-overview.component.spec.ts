import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {FederationSettingsComparisonStatus} from '@shared/generated.types';
import {federationInfo, memberStatuses, localStatus} from '@client/modules/federation/helpers/federation-status.fixtures';
import {settingsComparison} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {FederationOverviewComponent} from './federation-overview.component';

describe('FederationOverviewComponent', () => {
	beforeEach(() => TestBed.configureTestingModule({providers: [provideRouter([])]}));
	it('renders exact counters and distinguishes an unreachable member from digest agreement', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		const members = memberStatuses();
		members.members[2] = {...members.members[2], reachable: false, status: null, error: 'Connection refused'};
		members.digest_agreement!.compared_members = [1, 2];
		fixture.componentRef.setInput('info', federationInfo());
		fixture.componentRef.setInput('members', members);
		fixture.componentRef.setInput('local', localStatus());
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Connection refused');
		expect(fixture.nativeElement.textContent).toContain('18,446,744,073,709,551,615');
		expect(fixture.componentInstance.rows()[2].digest).toBe('Not compared');
		expect(fixture.componentInstance.reachable()).toBe(2);
	});
	it('shows each conflict kind and never calls an audit halt healthy', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		const members = memberStatuses();
		const local = localStatus();
		members.digest_agreement!.conflicts = [
			{kind: 'DIGEST_CONFLICT_KIND_CHECKPOINT_AUDIT', first_member_id: 1, second_member_id: 2, operation_count: '7'},
		];
		local.status!.checkpoint!.audit_mismatch = true;
		fixture.componentRef.setInput('members', members);
		fixture.componentRef.setInput('local', local);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Checkpoint audit: members 1 and 2');
		expect(fixture.nativeElement.textContent).toContain('Halted');
	});
	it('shows unavailable states only after the corresponding source has a value or an error', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		fixture.detectChanges();
		const health = fixture.nativeElement.querySelector('.health-grid');
		expect(health.textContent).toContain('Loading…');
		expect(health.textContent).not.toContain('Not reported');
		fixture.componentRef.setInput('members_error', {code: 40016, message: 'Busy'});
		fixture.componentRef.setInput('local', localStatus());
		fixture.detectChanges();
		expect(health.textContent).not.toContain('Loading…');
		expect(fixture.componentInstance.members_loaded()).toBeTrue();
	});
	it('warns when members go offline and distinguishes loss of consensus', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		const info = federationInfo();
		info.threshold_params = {member_count: 5, signature_threshold: 3, consensus_threshold: 4};
		const members = memberStatuses();
		members.members.push({...members.members[1], member_id: 4}, {...members.members[2], member_id: 5, reachable: false});
		fixture.componentRef.setInput('info', info);
		fixture.componentRef.setInput('members', members);
		fixture.detectChanges();
		expect(fixture.componentInstance.member_health()).toEqual({tone: 'warning', text: 'One offline · still running'});
		fixture.componentRef.setInput('members', {
			...members,
			members: members.members.map((member) => ({...member, reachable: member.member_id < 3})),
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.health-status[data-tone="inactive"]').textContent).toContain(
			'below consensus threshold',
		);
	});
	it('omits unknown networks, reports missing public URL, and preserves table semantics', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		fixture.componentRef.setInput('info', federationInfo());
		fixture.componentRef.setInput('public_api', false);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.identity').textContent).not.toContain('Network');
		expect(fixture.nativeElement.textContent).toContain("The mint's public URL isn't configured.");
		expect(fixture.nativeElement.querySelectorAll('th[scope="col"][role="columnheader"]').length).toBe(6);
		expect(fixture.nativeElement.querySelector('table').getAttribute('role')).toBe('table');
	});
	it('warns about inspections and labels single reports only when the reported policy permits them', () => {
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		const info = federationInfo();
		info.payment_observation_policy!.mint_quotes!.kind = 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION';
		fixture.componentRef.setInput('info', info);
		fixture.componentRef.setInput('local', localStatus());
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Single report · development policy');
		const local = localStatus();
		local.status!.payment_observations!.inspect = '2';
		fixture.componentRef.setInput('local', local);
		fixture.detectChanges();
		expect(fixture.componentInstance.payment_health()).toEqual({tone: 'warning', text: 'Reports to inspect'});
	});
	it('links an un-compared settings summary to member Info and Config and keeps the comparison error', () => {
		const settings = TestBed.inject(FederationSettingsService);
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		fixture.detectChanges();
		const row = fixture.nativeElement.querySelector('[data-testid="federation-settings-summary"]');
		expect(row.textContent).toContain('Not compared');
		expect(row.querySelector('a[href="/mint/info"]')).not.toBeNull();
		expect(row.querySelector('a[href="/mint/config"]')).not.toBeNull();
		settings.loading.set(true);
		fixture.detectChanges();
		expect(row.textContent).toContain('Comparing…');
		settings.loading.set(false);
		settings.error.set({code: 20003, message: 'Mint RPC unavailable', details: '14 UNAVAILABLE'});
		fixture.detectChanges();
		expect(row.querySelector('[role="alert"]').textContent).toContain('Settings comparison could not be refreshed');
	});
	it('renders matching, differing and partially compared settings without counting the local member', () => {
		const settings = TestBed.inject(FederationSettingsService);
		const fixture = TestBed.createComponent(FederationOverviewComponent);
		const comparison = settingsComparison();
		settings.comparison.set(comparison);
		fixture.detectChanges();
		const summary = fixture.nativeElement.querySelector('[data-testid="federation-settings-summary"] [role="status"]');
		expect(summary.textContent).toBe('All members match');
		settings.comparison.set({
			...comparison,
			members: comparison.members.map((member) =>
				member.local ? member : {...member, status: FederationSettingsComparisonStatus.Differs},
			),
		});
		fixture.detectChanges();
		expect(summary.textContent).toBe('2 members differ');
		settings.comparison.set({
			...comparison,
			members: comparison.members.map((member) => ({
				...member,
				status:
					member.member_id === 2 ? FederationSettingsComparisonStatus.Differs : FederationSettingsComparisonStatus.Unavailable,
			})),
		});
		fixture.detectChanges();
		expect(summary.textContent).toBe('1 member differs · 1 not compared');
	});
});
