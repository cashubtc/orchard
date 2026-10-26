/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
/* Local Dependencies */
import {NavPrimaryComponent} from './nav-primary.component';

describe('NavPrimaryComponent', () => {
	let component: NavPrimaryComponent;
	let fixture: ComponentFixture<NavPrimaryComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, OrcNavModule],
		}).compileComponents();

		fixture = TestBed.createComponent(NavPrimaryComponent);
		component = fixture.componentInstance;

		fixture.componentRef.setInput('user_name', 'TestUser');
		fixture.componentRef.setInput('user_error', false);
		fixture.componentRef.setInput('active_section', 'index');
		fixture.componentRef.setInput('active_event', null);
		fixture.componentRef.setInput('enabled_bitcoin', true);
		fixture.componentRef.setInput('enabled_lightning', true);
		fixture.componentRef.setInput('enabled_mint', true);
		fixture.componentRef.setInput('enabled_ecash', false);
		fixture.componentRef.setInput('online_bitcoin', true);
		fixture.componentRef.setInput('online_lightning', true);
		fixture.componentRef.setInput('online_mint', true);
		fixture.componentRef.setInput('syncing_bitcoin', false);
		fixture.componentRef.setInput('syncing_lightning', false);
		fixture.componentRef.setInput('block_count', 0);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
