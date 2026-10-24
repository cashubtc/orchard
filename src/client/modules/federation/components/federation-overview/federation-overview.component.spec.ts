import {TestBed} from '@angular/core/testing';
import {federationInfo, memberStatuses, localStatus} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationOverviewComponent} from './federation-overview.component';

describe('FederationOverviewComponent', () => {
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
		expect(fixture.nativeElement.textContent).toContain('18446744073709551615');
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
});
