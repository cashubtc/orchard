/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcCashuModule} from '@client/modules/cashu/cashu.module';
/* Local Dependencies */
import {CashuMethodIconComponent} from './cashu-method-icon.component';

describe('CashuMethodIconComponent', () => {
	let component: CashuMethodIconComponent;
	let fixture: ComponentFixture<CashuMethodIconComponent>;

	const icon = () => fixture.nativeElement.querySelector('mat-icon');

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcCashuModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(CashuMethodIconComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('display', {label: 'BOLT 11', icon: 'bolt', svg_icon: false});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('draws a font icon small by default, or at the size asked for', () => {
		expect(icon().textContent.trim()).toBe('bolt');
		expect(icon().classList).toContain('icon-sm');
		fixture.componentRef.setInput('size', null);
		fixture.detectChanges();
		expect(icon().classList).not.toContain('icon-sm');
	});

	it('draws an svg icon by name', () => {
		fixture.componentRef.setInput('display', {label: 'BOLT 12', icon: 'double_bolt', svg_icon: true});
		fixture.detectChanges();
		expect(icon().getAttribute('data-mat-icon-name')).toBe('double_bolt');
	});
});
