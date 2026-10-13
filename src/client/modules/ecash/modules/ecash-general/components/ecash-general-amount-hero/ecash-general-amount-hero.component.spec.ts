/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {CurrencyType} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralAmountHeroComponent} from './ecash-general-amount-hero.component';

describe('EcashGeneralAmountHeroComponent', () => {
	let component: EcashGeneralAmountHeroComponent;
	let fixture: ComponentFixture<EcashGeneralAmountHeroComponent>;
	let keys: string[];

	const shown = (): string => fixture.nativeElement.querySelector('.ecash-amount-hero').textContent.replace(/\s/g, '');
	const type = (inputType: string, data: string | null = null): void => {
		const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
		input.dispatchEvent(new InputEvent('beforeinput', {inputType, data, cancelable: true}));
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
			providers: [
				{
					provide: SettingDeviceService,
					useValue: {getLocale: () => 'en-US', getCurrency: () => ({type_btc: CurrencyType.GLYPH, type_fiat: CurrencyType.CODE})},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralAmountHeroComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('text', '1000');
		keys = [];
		component.key.subscribe((key) => keys.push(key));
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("shows the amount grouped, with the unit as the user's setting asks", () => {
		expect(shown()).toBe('₿1,000');

		fixture.componentRef.setInput('unit', 'usd');
		fixture.componentRef.setInput('text', '5.2');
		fixture.detectChanges();
		expect(shown()).toBe('5.20USD');
		expect(fixture.nativeElement.querySelectorAll('.ecash-amount-char.ghost').length).toBe(1);
	});

	it('measures a code sign wider than a glyph, so the amount can fit its width', () => {
		const glyph = component.width_ems();
		fixture.componentRef.setInput('unit', 'usd');
		fixture.componentRef.setInput('text', '1000');
		expect(component.width_ems()).toBeGreaterThan(glyph);
	});

	it('has no input in display mode', () => {
		expect(fixture.nativeElement.querySelector('input')).toBeNull();
	});

	it('turns typing and deleting into keys when editable', () => {
		fixture.componentRef.setInput('editable', true);
		fixture.detectChanges();
		const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
		input.setSelectionRange(4, 4);

		type('insertText', '5');
		type('insertText', 'x');
		type('deleteContentBackward');
		expect(keys).toEqual(['5', 'backspace']);
	});

	it('replaces the amount in one go on a paste or when it is all selected', () => {
		const replaced: string[] = [];
		component.replace.subscribe((text) => replaced.push(text));
		fixture.componentRef.setInput('editable', true);
		fixture.detectChanges();

		type('insertFromPaste', '2,1.5');
		const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
		input.setSelectionRange(0, input.value.length);
		type('deleteContentBackward');
		expect(replaced).toEqual(['21.5', '']);
		expect(keys).toEqual([]);
	});
});
