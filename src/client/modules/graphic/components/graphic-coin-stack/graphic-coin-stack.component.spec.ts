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

	it('drops in a whole new stack when its shape changes', () => {
		const first_coin = fixture.nativeElement.querySelector('.coin');
		fixture.componentRef.setInput('value', 2);
		fixture.detectChanges();
		const layer = fixture.nativeElement.querySelector('.coin-layer:not(.coin-layer-leave)');
		expect(layer.querySelectorAll('.coin').length).toBe(18);
		expect(layer.querySelector('.coin')).not.toBe(first_coin);
	});

	it('lets the replaced stack sink away, then clears it once its own animation ends', () => {
		fixture.componentRef.setInput('value', 2);
		fixture.detectChanges();
		const leaving = fixture.nativeElement.querySelector('.coin-layer-leave');
		expect(leaving.querySelectorAll('.coin').length).toBe(9);
		leaving.querySelector('.coin').dispatchEvent(new AnimationEvent('animationend', {bubbles: true}));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.coin-layer-leave')).not.toBeNull();
		leaving.dispatchEvent(new AnimationEvent('animationend'));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.coin-layer-leave')).toBeNull();
	});

	it('keeps the coins in place while the value moves within the same shape', () => {
		const first_coin = fixture.nativeElement.querySelector('.coin');
		fixture.componentRef.setInput('value', 1.01);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.coin')).toBe(first_coin);
	});

	it('numbers the coins so the top of the stack lands last', () => {
		const orders = [...fixture.nativeElement.querySelectorAll('.coin')].map((coin: HTMLElement) =>
			Number(coin.style.getPropertyValue('--drop-order')),
		);
		expect(orders[0]).toBe(8);
		expect(fixture.nativeElement.querySelector('.coin-layer').style.getPropertyValue('--coin-count')).toBe('9');
	});
});
