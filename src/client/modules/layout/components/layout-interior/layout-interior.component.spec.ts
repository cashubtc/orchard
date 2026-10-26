/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
/* Native Dependencies */
import {OrcRoutingModule} from '@client/modules/routing/routing.module';
/* Local Dependencies */
import {LayoutInteriorComponent} from './layout-interior.component';

describe('LayoutInteriorComponent', () => {
	let component: LayoutInteriorComponent;
	let fixture: ComponentFixture<LayoutInteriorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcRoutingModule, MatIconTestingModule],
			declarations: [LayoutInteriorComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(LayoutInteriorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('marks a setup daemon online without a public mint info response', () => {
		TestBed.inject(FederationService).mode.set('setup');
		expect(component.online_mint()).toBeTrue();
	});
	it('retains online dots when a status refresh leaves connection flags unchanged', () => {
		component.online_bitcoin.set(true);
		component.online_lightning.set(true);
		const config = TestBed.inject(ConfigService);
		config.config = {...config.config, bitcoin: {...config.config.bitcoin}, lightning: {...config.config.lightning}};
		fixture.detectChanges();
		expect(component.online_bitcoin()).toBeTrue();
		expect(component.online_lightning()).toBeTrue();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
