import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {SettingKey} from '@shared/generated.types';
import {SettingsServicesComponent} from './settings-services.component';

describe('SettingsServicesComponent', () => {
	const updateSettings = jasmine.createSpy().and.returnValue(of([]));
	const registerEvent = jasmine.createSpy();
	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [MatIconTestingModule],
			providers: [
				provideRouter([]),
				{provide: BitcoinService, useValue: {bitcoin_blockchain_info$: of(null)}},
				{provide: LightningService, useValue: {lightning_info$: of(null)}},
				{provide: FederationService, useValue: {mode: signal(null)}},
				{provide: CrewService, useValue: {isAdmin: () => of(true)}},
				{provide: ConfigService, useValue: {revision: signal(0), config: {taproot_assets: {enabled: false}}}},
				{provide: SettingAppService, useValue: {getSetting: () => ({value: false}), updateSettings}},
				{provide: EventService, useValue: {registerEvent}},
				{
					provide: ServiceConfigService,
					useValue: {load: () => of([bitcoinConfiguration()]), refresh_errors: signal({}), saved_checks: signal({})},
				},
			],
		});
	});

	it('loads the administrator list with source labels and independent integrations', () => {
		const fixture = TestBed.createComponent(SettingsServicesComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Saved in Orchard');
		expect(fixture.nativeElement.textContent).toContain('Values saved here override your environment');
		expect(fixture.nativeElement.textContent).toContain('Bitcoin Core · localhost:8332');
		expect(fixture.nativeElement.textContent).not.toContain('Remove');
		expect(fixture.nativeElement.querySelector('.connection-status').classList).toContain('tone-success');
		expect(fixture.nativeElement.querySelector('button[aria-label="Edit Bitcoin"]')).not.toBeNull();
	});

	it('turns the ecash wallet on and announces the change so the navigation follows', () => {
		const fixture = TestBed.createComponent(SettingsServicesComponent);
		fixture.detectChanges();
		const row: HTMLElement = fixture.nativeElement.querySelector('[data-service="ecash"]');
		expect(row.textContent).toContain('Off');
		Array.from<HTMLButtonElement>(row.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === 'Turn on')!
			.click();
		fixture.detectChanges();
		expect(updateSettings).toHaveBeenCalledWith([SettingKey.EcashEnabled], ['true']);
		expect(registerEvent).toHaveBeenCalledWith(jasmine.objectContaining({type: 'SUCCESS'}));
		expect(row.textContent).toContain('Enabled');
	});
});
