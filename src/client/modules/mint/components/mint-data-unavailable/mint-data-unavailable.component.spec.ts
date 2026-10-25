import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {MintDataUnavailableComponent} from './mint-data-unavailable.component';

describe('MintDataUnavailableComponent', () => {
	it('keeps a management route available without a database', () => {
		TestBed.configureTestingModule({providers: [provideRouter([])]});
		const fixture = TestBed.createComponent(MintDataUnavailableComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/mint/info');
	});
});
