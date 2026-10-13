/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {GraphicCoinStackComponent} from './graphic-coin-stack.component';

describe('GraphicCoinStackComponent', () => {
	let component: GraphicCoinStackComponent;
	let fixture: ComponentFixture<GraphicCoinStackComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcGraphicModule],
		}).compileComponents();

		fixture = TestBed.createComponent(GraphicCoinStackComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('value', 1);
		fixture.componentRef.setInput('counterpart', 2);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("draws the value's share of the stack in the unit's colour", () => {
		expect(fixture.nativeElement.querySelectorAll('.coin').length).toBe(9);
		expect(fixture.nativeElement.querySelector('.stack').classList).toContain('coin-btc');
	});
});
