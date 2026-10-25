import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {UserRole} from '@shared/generated.types';
import {SettingsServicesComponent} from './settings-services.component';

describe('SettingsServicesComponent', () => {
	it('loads the administrator list with source labels and independent integrations', () => {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{provide: CrewService, useValue: {loadUser: () => of({role: UserRole.Admin})}},
				{provide: ConfigService, useValue: {revision: signal(0), config: {taproot_assets: {enabled: false}}}},
				{provide: ServiceConfigService, useValue: {load: () => of([bitcoinConfiguration()])}},
			],
		});
		const fixture = TestBed.createComponent(SettingsServicesComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Saved in Orchard');
		expect(fixture.nativeElement.textContent).toContain('Each connection is independent');
	});
});
