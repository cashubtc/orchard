/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {ConfigService} from '@client/modules/config/services/config.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {of} from 'rxjs';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {settingsComparison, settingsDifference} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {FederationSettingsComparisonGroup, FederationSettingsComparisonStatus} from '@shared/generated.types';
/* Native Dependencies */
import {OrcMintSubsectionInfoModule} from '@client/modules/mint/modules/mint-subsection-info/mint-subsection-info.module';
/* Local Dependencies */
import {MintSubsectionInfoComponent} from './mint-subsection-info.component';

describe('MintSubsectionInfoComponent', () => {
	let component: MintSubsectionInfoComponent;
	let fixture: ComponentFixture<MintSubsectionInfoComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionInfoModule],
			providers: [{provide: ActivatedRoute, useValue: {snapshot: {data: {mint_info_rpc: {urls: [], contact: []}}}}}],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionInfoComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('refreshes public mint info after an edit only when a public URL is configured', () => {
		const config = TestBed.inject(ConfigService);
		const service = TestBed.inject(MintService);
		const load = spyOn(service, 'loadMintInfo').and.returnValue(of());
		config.config = {...config.config, mint: {...config.config.mint, public_api: false}};
		component['onSuccess']();
		expect(load).not.toHaveBeenCalled();
		config.config = {...config.config, mint: {...config.config.mint, public_api: true}};
		component['onSuccess']();
		expect(load).toHaveBeenCalledTimes(1);
	});
	it('keeps the standalone URL editor and avoids member-only wording', () => {
		expect(fixture.nativeElement.querySelector('orc-mint-subsection-info-form-urls')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('orc-federation-settings-summary')).toBeNull();
	});

	it('renders member scope, immutable federation URLs and name differences with one comparison load', () => {
		fixture.destroy();
		TestBed.inject(FederationService).mode.set('member');
		const load = spyOn(FederationSettingsService.prototype, 'load');
		fixture = TestBed.createComponent(MintSubsectionInfoComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		const result = settingsComparison();
		result.members[1].status = FederationSettingsComparisonStatus.Differs;
		result.members[1].differences = [
			settingsDifference({
				group: FederationSettingsComparisonGroup.Info,
				setting: 'name',
				nut: null,
				method: null,
				unit: null,
				their_value: 'Two',
			}),
		];
		TestBed.inject(FederationSettingsService).comparison.set(result);
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('These details belong to this member.');
		expect(element.textContent).toContain('Differs from member 2 on 1 setting');
		expect(element.textContent).toContain('Differs on member 2: Two');
		expect(element.textContent).toContain('https://mint1.example');
		expect(element.textContent).toContain('https://peer1.example');
		expect(element.textContent).toContain("Set at federation setup. Federated wallets use these, and they can't be changed yet.");
		expect(element.querySelector('orc-mint-subsection-info-form-urls')).toBeNull();
		expect(load).toHaveBeenCalledTimes(1);
		expect(component.form_array_urls.disabled).toBeTrue();
	});
});
