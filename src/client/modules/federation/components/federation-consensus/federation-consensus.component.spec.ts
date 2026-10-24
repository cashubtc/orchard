import {TestBed} from '@angular/core/testing';
import {localStatus} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationConsensusComponent} from './federation-consensus.component';

describe('FederationConsensusComponent', () => {
	it('prominently renders audit mismatch as a halt with no clear action', () => {
		const fixture = TestBed.createComponent(FederationConsensusComponent);
		const local = localStatus();
		local.status!.checkpoint!.audit_mismatch = true;
		fixture.componentRef.setInput('local', local);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Halted: checkpoint audit mismatch');
		expect(fixture.nativeElement.textContent).not.toContain('Serving wallets');
		expect(fixture.nativeElement.querySelector('button')).toBeNull();
	});
	it('renders INSPECT reports, unknown actions, truncated results and invalid-operation alerts', () => {
		const fixture = TestBed.createComponent(FederationConsensusComponent);
		const local = localStatus();
		const report = {
			context: 'PAYMENT_OBSERVATION_CONTEXT_MINT_QUOTE',
			quote: 'quote',
			status: 'future_status',
			recommended_action: 'PAYMENT_OBSERVATION_REPORT_ACTION_INSPECT',
			required: 3,
			total_observations: '2',
			quote_age_secs: '100',
			stale: true,
			conflicting_observers: [1],
			competing_terminal_state_observers: [],
			groups: [],
		};
		local.status!.payment_observations!.reports = [report, {...report, quote: 'future', recommended_action: 'FUTURE_ACTION'}];
		local.status!.payment_observations!.truncated = true;
		local.status!.invalid_operation_alerts = [
			{source: 'client_ip', alerting_buckets: '1', max_count: '200', threshold: '100', window_secs: '60'},
		];
		fixture.componentRef.setInput('local', local);
		fixture.detectChanges();
		for (const text of ['quote', 'future_status', 'FUTURE_ACTION', 'truncated', 'client_ip', '200'])
			expect(fixture.nativeElement.textContent).toContain(text);
	});
});
