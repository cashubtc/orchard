import {signal} from '@angular/core';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {TestBed} from '@angular/core/testing';

import {NavService} from './nav.service';

describe('NavService', () => {
	let service: NavService;
	const mode = signal('setup');

	beforeEach(() => {
		mode.set('setup');
		TestBed.configureTestingModule({providers: [{provide: FederationService, useValue: {mode}}]});
		service = TestBed.inject(NavService);
	});

	it('shows only Federation setup during setup and restores normal mint navigation afterward', () => {
		expect(service.getMenuItems('mint')).toEqual([{name: 'Federation setup', navroute: 'mint/federation', subsection: 'federation'}]);
		mode.set('member');
		expect(service.getMenuItems('mint').some((item) => item.name === 'Dashboard')).toBeTrue();
		expect(service.getMenuItems('mint').some((item) => item.name === 'Federation')).toBeTrue();
		mode.set('standalone');
		expect(service.getMenuItems('mint').some((item) => item.name === 'Federation')).toBeFalse();
	});
});
