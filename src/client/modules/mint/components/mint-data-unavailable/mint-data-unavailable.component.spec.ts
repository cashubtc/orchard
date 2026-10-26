import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ConfigService} from '@client/modules/config/services/config.service';
import {MintDataUnavailableComponent} from './mint-data-unavailable.component';

describe('MintDataUnavailableComponent', () => {
	for (const connection of ['database', 'public_api']) {
		it(`names the missing ${connection} while keeping a management route available`, () => {
			TestBed.configureTestingModule({
				providers: [
					provideRouter([]),
					{provide: ActivatedRoute, useValue: {queryParamMap: of(convertToParamMap({connection}))}},
					{provide: ConfigService, useValue: {config: {mint: {database: false, public_api: false}}}},
				],
			});
			const fixture = TestBed.createComponent(MintDataUnavailableComponent);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/mint/info');
			const text = fixture.nativeElement.textContent;
			expect(text).toContain(connection === 'database' ? 'connected mint database' : "mint's public URL");
			expect(text).not.toContain('database or public mint URL');
		});
	}
});
