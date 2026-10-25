/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
/* Local Dependencies */
import {NavPrimaryItemsComponent} from './nav-primary-items.component';

describe('NavPrimaryItemsComponent', () => {
	let component: NavPrimaryItemsComponent;
	let fixture: ComponentFixture<NavPrimaryItemsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, OrcNavModule],
		}).compileComponents();

		fixture = TestBed.createComponent(NavPrimaryItemsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('active_section', '');
		fixture.componentRef.setInput('enabled_bitcoin', false);
		fixture.componentRef.setInput('enabled_lightning', false);
		fixture.componentRef.setInput('enabled_mint', false);
		fixture.componentRef.setInput('online_bitcoin', false);
		fixture.componentRef.setInput('online_lightning', false);
		fixture.componentRef.setInput('online_mint', false);
		fixture.componentRef.setInput('syncing_bitcoin', false);
		fixture.componentRef.setInput('syncing_lightning', false);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('only renders configured services and responds to hot changes', () => {
		const mint_items = (): number => fixture.nativeElement.querySelectorAll('orc-nav-primary-item[navroute="mint"]').length;
		expect(mint_items()).toBe(0);
		fixture.componentRef.setInput('enabled_mint', true);
		fixture.detectChanges();
		expect(mint_items()).toBe(1);
		fixture.componentRef.setInput('enabled_mint', false);
		fixture.detectChanges();
		expect(mint_items()).toBe(0);
	});
});
