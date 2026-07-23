/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, NEVER} from 'rxjs';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AiService} from '@client/modules/ai/services/ai/ai.service';
/* Native Dependencies */
import {OrcMintSubsectionKeysetsModule} from '@client/modules/mint/modules/mint-subsection-keysets/mint-subsection-keysets.module';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
/* Shared Dependencies */
import {AssistantToolName, AiAssistant} from '@shared/generated.types';
/* Local Dependencies */
import {MintSubsectionKeysetsComponent} from './mint-subsection-keysets.component';

describe('MintSubsectionKeysetsComponent', () => {
	let component: MintSubsectionKeysetsComponent;
	let fixture: ComponentFixture<MintSubsectionKeysetsComponent>;
	let mint_service_stub: {rotateMintKeysets: jasmine.Spy; [key: string]: any};

	beforeEach(async () => {
		mint_service_stub = {
			loadMintAnalyticsKeysets: () => of<any[]>([]),
			loadMintKeysetCounts: () => of<any[]>([]),
			rotateMintKeysets: jasmine.createSpy('rotateMintKeysets').and.returnValue(NEVER),
		};
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionKeysetsModule],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							data: {
								mint_keysets: [
									{
										id: 'k1',
										unit: 'sat',
										active: true,
										valid_from: 1,
										input_fee_ppk: 1000,
									},
								],
							},
						},
					},
				},
				{provide: MintService, useValue: mint_service_stub},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionKeysetsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('defaults the final_expiry control to null after resetForm', () => {
		expect(component.form_keyset.get('final_expiry')?.value).toBeNull();
	});

	it('rotates with final_expiry as the end-of-day unix timestamp when a date is set', () => {
		const picked = DateTime.fromFormat('2030-01-15', 'yyyy-MM-dd');
		component.form_keyset.patchValue({final_expiry: picked});
		(component as any).onConfirmedEvent();
		const args = mint_service_stub.rotateMintKeysets.calls.mostRecent().args;
		expect(args[4]).toBe(picked.endOf('day').toUnixInteger());
	});

	it('rotates with null final_expiry when no date is set', () => {
		component.form_keyset.patchValue({final_expiry: null});
		(component as any).onConfirmedEvent();
		const args = mint_service_stub.rotateMintKeysets.calls.mostRecent().args;
		expect(args[4]).toBeNull();
	});

	it('patches the final_expiry control from the assistant date string', () => {
		(component as any).executeAssistantFunction({
			function: {name: AssistantToolName.MintKeysetRotationFinalExpiryUpdate, arguments: {final_expiry: '2030-01-15'}},
		});
		const value = component.form_keyset.get('final_expiry')?.value as DateTime;
		expect(value.toFormat('yyyy-MM-dd')).toBe('2030-01-15');
	});

	it('includes the Final Expiry line in the rotation assistant context', () => {
		const ai_service = TestBed.inject(AiService);
		const spy = spyOn(ai_service, 'openAiSocket');
		(component as any).hireRotationAssistant(AiAssistant.MintKeysetRotation, 'set expiry');
		const context = spy.calls.mostRecent().args[2] as string;
		expect(context).toContain('**Final Expiry:**');
	});
});
