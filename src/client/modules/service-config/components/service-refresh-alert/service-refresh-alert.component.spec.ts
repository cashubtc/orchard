import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {ServiceKind} from '@shared/generated.types';
import {ServiceRefreshAlertComponent} from './service-refresh-alert.component';

describe('ServiceRefreshAlertComponent', () => {
	it('takes no space until a refresh fails, then retries only that refresh', () => {
		const api = {refresh_errors: signal<Partial<Record<ServiceKind, string | null>>>({}), retry: jasmine.createSpy()};
		TestBed.configureTestingModule({providers: [{provide: ServiceConfigService, useValue: api}]});
		const fixture = TestBed.createComponent(ServiceRefreshAlertComponent);
		fixture.componentRef.setInput('service', ServiceKind.Bitcoin);
		fixture.detectChanges();
		expect(fixture.nativeElement.classList).toContain('hidden');
		expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
		api.refresh_errors.set({lightning: 'Refreshing status failed.', bitcoin: 'Refreshing status failed. offline (10001)'});
		fixture.detectChanges();
		expect(fixture.nativeElement.classList).not.toContain('hidden');
		expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('offline (10001)');
		fixture.nativeElement.querySelector('button').click();
		expect(api.retry).toHaveBeenCalledOnceWith(ServiceKind.Bitcoin);
		fixture.componentRef.setInput('disabled', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('button').disabled).toBeTrue();
	});
});
