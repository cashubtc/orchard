/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcErrorModule} from '@client/modules/error/error.module';
/* Local Dependencies */
import {ErrorResolveComponent} from './error-resolve.component';

describe('ErrorResolveComponent', () => {
	let component: ErrorResolveComponent;
	let fixture: ComponentFixture<ErrorResolveComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcErrorModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ErrorResolveComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('error', {code: 20001, message: 'Test'});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders actionable restart guidance from the shared error catalog', () => {
		fixture.componentRef.setInput('error', {code: 40016, message: 'MintRestartRequired'});
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('MINT RESTART REQUIRED');
		expect(element.textContent).toContain('Restart cdk-mintd, then retry.');
		expect(element.textContent).toContain('40016');
	});

	it('keeps the existing Bitcoin connection explanation and code', () => {
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('BITCOIN RPC ERROR');
		expect(element.textContent).toContain('Orchard was unable to connect to the bitcoin RPC');
		expect(element.textContent).toContain('20001');
	});

	it('keeps unknown errors readable without duplicating their support code', () => {
		fixture.componentRef.setInput('error', {code: 99999, message: 'FutureBackendError'});
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('UNKNOWN ERROR');
		expect(element.textContent).toContain('FutureBackendError');
		expect(element.textContent?.match(/99999/g)?.length).toBe(1);
	});

	it('keeps compact cards displaying the title and support code', () => {
		fixture.componentRef.setInput('mode', 'small');
		fixture.componentRef.setInput('error', {code: 30002, message: 'LightningRpcActionError'});
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.textContent).toContain('LIGHTNING RPC ACTION ERROR');
		expect(element.textContent).toContain('30002');
	});
});
