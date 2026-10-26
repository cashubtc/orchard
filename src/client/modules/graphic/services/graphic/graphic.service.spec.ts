import {TestBed} from '@angular/core/testing';
import {MatIconRegistry} from '@angular/material/icon';

import {GraphicService} from './graphic.service';

describe('GraphicService', () => {
	let service: GraphicService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(GraphicService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('registers the Skipped icon under the name Review uses', () => {
		const add = spyOn(TestBed.inject(MatIconRegistry), 'addSvgIcon').and.callThrough();
		service.init();
		const skipped = add.calls.allArgs().find(([name]) => name === 'do_not_disturb_on');
		expect(String(skipped?.[1])).toContain('icon/do-not-disturb-on.svg');
	});
});
