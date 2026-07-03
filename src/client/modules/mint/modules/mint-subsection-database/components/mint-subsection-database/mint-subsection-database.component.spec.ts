/* Core Dependencies */
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, throwError} from 'rxjs';
/* Application Dependencies */
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
/* Native Dependencies */
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
/* Local Dependencies */
import {MintSubsectionDatabaseComponent} from './mint-subsection-database.component';

describe('MintSubsectionDatabaseComponent', () => {
	let component: MintSubsectionDatabaseComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseComponent>;
	let lightningService: LightningService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
			declarations: [MintSubsectionDatabaseComponent],
			providers: [{provide: ActivatedRoute, useValue: {snapshot: {data: {mint_keysets: []}}}}],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseComponent);
		component = fixture.componentInstance;
		lightningService = TestBed.inject(LightningService);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('onMoreRequest', () => {
		it('should skip lightning decode for onchain requests', () => {
			const decode_spy = spyOn(lightningService, 'getLightningRequest').and.returnValue(of({} as any));
			(component as any).lightning_enabled = true;
			component.lightning_request = {} as any;

			component.onMoreRequest({
				id: 'quote-id',
				request: 'bcrt1qexampleonchainaddress',
				payment_method: 'onchain',
				unit: 'sat',
				created_time: 1,
				amount_paid: 1000,
			} as any);

			expect(decode_spy).not.toHaveBeenCalled();
			expect(component.lightning_request).toBeNull();
			expect(component.loading_more).toBeFalse();
		});

		it('should decode bolt11 and bolt12 payment requests', fakeAsync(() => {
			const decode_spy = spyOn(lightningService, 'getLightningRequest').and.returnValue(of({destination: 'pubkey'} as any));
			(component as any).lightning_enabled = true;

			component.onMoreRequest({request: 'lnbc1example', payment_method: 'bolt11'} as any);
			tick();

			component.onMoreRequest({request: 'lno1example', payment_method: 'bolt12'} as any);
			tick();

			expect(decode_spy).toHaveBeenCalledTimes(2);
			expect(decode_spy).toHaveBeenCalledWith('lnbc1example');
			expect(decode_spy).toHaveBeenCalledWith('lno1example');
			expect(component.loading_more).toBeFalse();
		}));

		it('should clear loading state when lightning decode fails', fakeAsync(() => {
			const error_spy = spyOn(console, 'error');
			spyOn(lightningService, 'getLightningRequest').and.returnValue(throwError(() => new Error('decode failed')));
			(component as any).lightning_enabled = true;

			component.onMoreRequest({request: 'lnbc1bad', payment_method: 'bolt11'} as any);
			tick();

			expect(component.lightning_request).toBeNull();
			expect(component.loading_more).toBeFalse();
			expect(error_spy).toHaveBeenCalled();
		}));
	});
});
