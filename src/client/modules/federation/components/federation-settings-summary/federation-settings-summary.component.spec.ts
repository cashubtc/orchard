import {TestBed} from '@angular/core/testing';
import {FederationSettingsComparisonGroup as Group, FederationSettingsComparisonStatus as Status} from '@shared/generated.types';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {settingsComparison, settingsDifference} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {FederationSettingsSummaryComponent} from './federation-settings-summary.component';

describe('FederationSettingsSummaryComponent', () => {
	let service: FederationSettingsService;
	beforeEach(() => {
		service = TestBed.inject(FederationSettingsService);
		spyOn(service, 'load');
	});

	it('renders matches, field counts, verbatim fetch failures and an explicit refresh action', () => {
		const fixture = TestBed.createComponent(FederationSettingsSummaryComponent);
		const result = settingsComparison();
		fixture.componentRef.setInput('group', Group.Info);
		service.comparison.set(result);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Matches members 2 and 3');
		fixture.nativeElement.querySelector('button').click();
		expect(service.load).toHaveBeenCalledOnceWith(true);
		result.members[1].status = Status.Differs;
		result.members[1].differences = ['name', 'description'].map((setting) =>
			settingsDifference({group: Group.Info, setting, nut: null, method: null, unit: null}),
		);
		result.members[2].status = Status.Unavailable;
		result.members[2].error = 'socket hang up\nproxy refused';
		service.comparison.set({...result});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Differs from member 2 on 2 settings');
		expect(fixture.nativeElement.textContent).toContain('socket hang up\nproxy refused');
		expect(fixture.nativeElement.textContent).not.toContain('Matches');
		service.loading.set(true);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('button').disabled).toBeTrue();
	});

	it('warns about the default quote member and distinguishes an unsupported transport', () => {
		const fixture = TestBed.createComponent(FederationSettingsSummaryComponent);
		const result = settingsComparison();
		result.members[1].status = Status.Differs;
		result.members[1].differences = [settingsDifference()];
		result.members[2].status = Status.NotComparable;
		result.members[2].error = "Can't be compared from Orchard";
		fixture.componentRef.setInput('group', Group.Config);
		service.comparison.set(result);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Member 1 is the default quote member');
		expect(fixture.nativeElement.textContent).toContain("Member 3: Can't be compared from Orchard");
	});
});
