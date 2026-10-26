import {TestBed} from '@angular/core/testing';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {settingsComparison, settingsDifference} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {FederationSettingsHintComponent} from './federation-settings-hint.component';

describe('FederationSettingsHintComponent', () => {
	it('renders its own setting from the shared comparison as text and highlights the default quote member', () => {
		const comparison = settingsComparison();
		comparison.members[0].local = false;
		comparison.members[1].local = true;
		comparison.local_member_id = 2;
		comparison.members[0].differences = [settingsDifference({their_value: '18446744073709551615 <script>unsafe()</script>'})];
		const fixture = TestBed.createComponent(FederationSettingsHintComponent);
		fixture.componentRef.setInput('setting', 'max_amount');
		fixture.componentRef.setInput('nut', 'nut4');
		fixture.componentRef.setInput('method', 'bolt11');
		fixture.componentRef.setInput('unit', 'sat');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('p')).toBeNull();
		TestBed.inject(FederationSettingsService).comparison.set(comparison);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Differs on member 1: 18446744073709551615 <script>unsafe()</script>');
		expect(fixture.nativeElement.textContent).toContain('Default quote member');
		expect(fixture.nativeElement.querySelector('script')).toBeNull();
		fixture.componentRef.setInput('unit', 'usd');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('p')).toBeNull();
	});
});
