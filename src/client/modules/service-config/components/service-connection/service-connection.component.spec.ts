import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {ServiceKind, type OrchardConnectionCheck} from '@shared/generated.types';
import {ServiceConnectionComponent} from './service-connection.component';

describe('ServiceConnectionComponent', () => {
	const failure: OrchardConnectionCheck = {
		ok: false,
		warning: false,
		saved: false,
		title: 'Failed',
		context: 'localhost:8332',
		diagnostic: 'ECONNREFUSED',
		fields: ['port'],
	};
	const api = {
		test: jasmine.createSpy(),
		save: jasmine.createSpy(),
		retry: jasmine.createSpy(),
		refresh_errors: signal<Partial<Record<ServiceKind, string | null>>>({}),
	};
	beforeEach(() => {
		api.test.and.returnValue(of(failure));
		api.save.and.callFake((_input: unknown, save_unreachable: boolean) => of({...failure, saved: save_unreachable}));
		api.refresh_errors.set({});
		api.retry.calls.reset();
		TestBed.configureTestingModule({providers: [{provide: ServiceConfigService, useValue: api}]});
	});
	it('uses the failed-test actions and emits applied only for a saved connection', () => {
		const fixture = TestBed.createComponent(ServiceConnectionComponent);
		fixture.componentRef.setInput('configuration', bitcoinConfiguration());
		fixture.componentRef.setInput('context', 'onboarding');
		fixture.detectChanges();
		const applied = jasmine.createSpy();
		fixture.componentInstance.applied.subscribe(applied);
		expect(fixture.nativeElement.textContent).toContain('Test connection');
		fixture.componentInstance.submit(false);
		fixture.detectChanges();
		expect(applied).not.toHaveBeenCalled();
		const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Test again'),
		)!;
		expect(retry.classList).toContain('mat-mdc-unelevated-button');
		expect(fixture.nativeElement.textContent).toContain('Save without a working connection');
		fixture.componentInstance.submit(true, true);
		expect(applied).toHaveBeenCalledWith({
			check: {...failure, saved: true},
			configuration: jasmine.objectContaining({enabled: true, source: 'orchard'}),
		});
		fixture.componentInstance.changed();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('Save without a working connection');
	});
	it('keeps a saved result on refresh failure and retries without saving again', () => {
		api.save.and.returnValue(of({...failure, ok: true, saved: true}));
		api.retry.and.callFake(() => api.refresh_errors.set({}));
		const fixture = TestBed.createComponent(ServiceConnectionComponent);
		fixture.componentRef.setInput('configuration', bitcoinConfiguration());
		fixture.detectChanges();
		fixture.componentInstance.submit(true);
		api.refresh_errors.set({bitcoin: 'Refreshing status failed. Status is unavailable.'});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="status"].orc-status-active-color').textContent).toContain(
			'Saved and reconnected',
		);
		expect(fixture.nativeElement.textContent.match(/Saved and reconnected/g)?.length).toBe(1);
		expect(fixture.nativeElement.querySelector('orc-service-refresh-alert [role="alert"]').textContent).toContain(
			'Status is unavailable.',
		);
		const save_count = api.save.calls.count();
		const retry: HTMLButtonElement = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Retry status refresh'),
		)!;
		retry.click();
		fixture.detectChanges();
		expect(api.save.calls.count()).toBe(save_count);
		expect(api.retry).toHaveBeenCalledWith(ServiceKind.Bitcoin);
		expect(fixture.componentInstance.saved()).toBeTrue();
		expect(fixture.nativeElement.textContent).not.toContain('Retry status refresh');
	});
	it('names the environment prefix and blocks requests during a parent refresh', () => {
		const fixture = TestBed.createComponent(ServiceConnectionComponent);
		fixture.componentRef.setInput('configuration', {...bitcoinConfiguration(), source: 'environment'});
		fixture.componentRef.setInput('pending', true);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('BITCOIN_*');
		const calls = api.test.calls.count();
		fixture.componentInstance.submit(false);
		expect(api.test.calls.count()).toBe(calls);
	});
});
