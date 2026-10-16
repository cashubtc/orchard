/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralMintDetailsComponent} from './ecash-general-mint-details.component';

describe('EcashGeneralMintDetailsComponent', () => {
	let component: EcashGeneralMintDetailsComponent;
	let fixture: ComponentFixture<EcashGeneralMintDetailsComponent>;

	const info = new MintInfo({
		name: 'Cedar Community Mint',
		pubkey: '02a9f3c7e41b8c81e',
		urls: ['https://mint.cedar.example', 'http://cedarmintq7v3xabcdefghij.onion'],
		contact: [
			{method: 'email', info: 'ops@cedar.example'},
			{method: 'signal', info: '+1 555 0100'},
		],
		nuts: {
			nut4: {
				disabled: false,
				methods: [
					{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
					{method: 'onchain', unit: 'sat', min_amount: 10000, max_amount: null, options: {confirmations: 3}},
				],
			},
			nut5: {disabled: false, methods: [{method: 'bolt12', unit: 'sat'}]},
		},
	});

	const text = () => fixture.nativeElement.textContent as string;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintDetailsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('info', info);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lists connections, onchain confirmations and contacts', () => {
		expect(component.confirmations()).toBe(3);
		expect(component.connections().map((connection) => connection.type)).toEqual(['clearnet', 'tor']);
		expect(component.contacts()).toEqual([
			{info: 'ops@cedar.example', icon: 'mail', svg: ''},
			{info: '+1 555 0100', icon: 'link', svg: ''},
		]);
	});

	it('splits the features into two columns that fill top to bottom', () => {
		const grid = fixture.nativeElement.querySelector('.ecash-mint-details-features');
		expect(component.feature_rows()).toBe(Math.ceil(component.features().length / 2));
		expect(grid.style.getPropertyValue('--rows')).toBe(`${component.feature_rows()}`);
	});

	it("shows the server time only when the mint's clock is off", () => {
		fixture.componentRef.setInput('time_offset', 0);
		fixture.detectChanges();
		expect(text()).not.toContain('Server time');
		fixture.componentRef.setInput('time_offset', 180);
		fixture.detectChanges();
		expect(text()).toContain('3 min ahead of Orchard');
	});
});
