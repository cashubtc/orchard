import {TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import type {OrchardFederationSetupDkg} from '@shared/generated.types';
import {FederationSetupKeygenComponent} from './federation-setup-keygen.component';

describe('FederationSetupKeygenComponent', () => {
	/** Key generation part-way through, on a three-member federation. */
	function dkg(overrides: Partial<OrchardFederationSetupDkg> = {}): OrchardFederationSetupDkg {
		return {
			phase: 'SETUP_DKG_PHASE_REVEAL',
			participant_states: '3',
			commitments: '3',
			reveals: '1',
			secret_share_contributions: '0',
			keyset_shares: '0',
			frost_root_public_configs: '0',
			transcript_signatures: '0',
			final_config_confirmations: '0',
			confirmed_members: [1],
			finalized_ready: false,
			transcript_hash: 'b81d1f88aa00bb11cc22dd33ee44ff550ee984',
			...overrides,
		};
	}

	it('marks stages with progress, confirms members as chips and activates only when final', () => {
		TestBed.configureTestingModule({imports: [MatIconTestingModule]});
		const fixture = TestBed.createComponent(FederationSetupKeygenComponent);
		fixture.componentRef.setInput('dkg', dkg());
		fixture.componentRef.setInput('member_count', 3);
		fixture.detectChanges();
		const stages: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.stage-list li'));
		expect(stages.length).toBe(8);
		expect(stages[2].dataset['state']).toBe('active');
		expect(stages[3].dataset['state']).toBe('pending');
		expect(fixture.nativeElement.querySelectorAll('.member-chip.confirmed').length).toBe(1);
		expect(fixture.nativeElement.querySelector('.digest-list').textContent).toContain('b81d1f88...0ee984');
		const activate: HTMLButtonElement = fixture.nativeElement.querySelector('.setup-aside button');
		expect(activate.disabled).toBeTrue();
		fixture.componentRef.setInput('dkg', dkg({finalized_ready: true}));
		fixture.detectChanges();
		expect(fixture.componentInstance.stages().every((stage) => stage.state === 'done')).toBeTrue();
		const activated = jasmine.createSpy();
		fixture.componentInstance.activate.subscribe(activated);
		activate.click();
		expect(activated).toHaveBeenCalled();
	});

	it('waits for progress before the mint reports key generation', () => {
		TestBed.configureTestingModule({imports: [MatIconTestingModule]});
		const fixture = TestBed.createComponent(FederationSetupKeygenComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Waiting for key generation progress');
	});
});
