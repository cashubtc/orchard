/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralRestoreUrlsComponent} from './ecash-general-restore-urls.component';

describe('EcashGeneralRestoreUrlsComponent', () => {
	let component: EcashGeneralRestoreUrlsComponent;
	let fixture: ComponentFixture<EcashGeneralRestoreUrlsComponent>;

	const count = (): string => fixture.nativeElement.querySelector('[data-testid="ecash-general-restore-urls-count"]').textContent.trim();

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralRestoreUrlsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('urls', ['https://kelp.example', 'https://cedar.example']);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('copies the URLs one per line', () => {
		expect(component.text()).toBe('https://kelp.example\nhttps://cedar.example');
		expect(count()).toBe('2 mint URLs');
	});

	it('counts a single URL in the singular', () => {
		fixture.componentRef.setInput('urls', ['https://cedar.example']);
		fixture.detectChanges();
		expect(count()).toBe('1 mint URL');
	});
});
