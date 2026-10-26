import {TestBed} from '@angular/core/testing';
import {Subject, of, throwError} from 'rxjs';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import type {ServiceForm} from '@client/modules/service-config/types/service-config.types';
import type {OrchardConnectionCheck} from '@shared/generated.types';
import {ServiceFormService} from './service-form.service';

describe('ServiceFormService', () => {
	const failure: OrchardConnectionCheck = {
		ok: false,
		warning: false,
		title: 'Failed',
		context: 'localhost',
		diagnostic: 'ECONNREFUSED',
		fields: ['port'],
	};
	const api = {save: jasmine.createSpy(), test: jasmine.createSpy()};
	let service: ServiceFormService;
	let form: ServiceForm;
	beforeEach(() => {
		api.save.calls.reset();
		api.test.calls.reset();
		TestBed.configureTestingModule({providers: [ServiceFormService, {provide: ServiceConfigService, useValue: api}]});
		service = TestBed.inject(ServiceFormService);
		form = service.initialize(bitcoinConfiguration());
	});
	it('prevents duplicate requests and restores controls after a failed test', () => {
		const pending = new Subject<OrchardConnectionCheck>();
		api.test.and.returnValue(pending);
		service.submit(false).subscribe();
		service.submit(false).subscribe();
		expect(api.test).toHaveBeenCalledTimes(1);
		expect(form.disabled).toBeTrue();
		pending.next(failure);
		pending.complete();
		expect(service.result()).toEqual(failure);
		expect(form.enabled).toBeTrue();
		expect(service.saved()).toBeFalse();
	});
	it('saves only after success or explicit bypass and invalidates the offer on edit', () => {
		api.save.and.returnValue(of(failure));
		service.submit(true).subscribe();
		expect(service.saved()).toBeFalse();
		service.submit(true, true).subscribe();
		expect(service.saved()).toBeTrue();
		service.changed();
		expect(service.result()).toBeNull();
		expect(service.saved()).toBeFalse();
	});
	it('releases busy state when the request fails', () => {
		api.test.and.returnValue(throwError(() => new Error('offline')));
		service.submit(false).subscribe();
		expect(service.busy()).toBeFalse();
		expect(form.enabled).toBeTrue();
		expect(service.error()).toBeTruthy();
	});
});
