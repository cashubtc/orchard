import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {SettingsServicesComponent} from './settings-services.component';

describe('SettingsServicesComponent', () => {
	it('loads the administrator list with source labels and independent integrations', () => {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{provide: BitcoinService, useValue: {bitcoin_blockchain_info$: of(null)}},
				{provide: LightningService, useValue: {lightning_info$: of(null)}},
				{provide: FederationService, useValue: {mode: signal(null)}},
				{provide: CrewService, useValue: {isAdmin: () => of(true)}},
				{provide: ConfigService, useValue: {revision: signal(0), config: {taproot_assets: {enabled: false}}}},
				{
					provide: ServiceConfigService,
					useValue: {load: () => of([bitcoinConfiguration()]), refresh_errors: signal({}), saved_checks: signal({})},
				},
			],
		});
		const fixture = TestBed.createComponent(SettingsServicesComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Saved in Orchard');
		expect(fixture.nativeElement.textContent).toContain('Each connection is independent');
		expect(fixture.nativeElement.textContent).toContain('Bitcoin Core · localhost:8332');
		expect(fixture.nativeElement.textContent).not.toContain('Remove');
		expect(fixture.nativeElement.querySelector('.connection-status mat-icon').textContent).toBe('task_alt');
	});
});
