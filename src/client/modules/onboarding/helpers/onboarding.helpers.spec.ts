import {ServiceKind} from '@shared/generated.types';
import {onboardingDestination, onboardingReview, onboardingService} from './onboarding.helpers';
import {onboardingConfiguration} from './onboarding.fixture';

describe('onboarding helpers', () => {
	it('only accepts supported direct links and sends members to their dashboard', () => {
		expect(onboardingService('ecash')).toBeNull();
		expect(onboardingService('mint')).toBe(ServiceKind.Mint);
		expect(onboardingDestination('member')).toBe('/mint/federation');
		for (const mode of ['standalone', 'setup', 'unreachable', null]) expect(onboardingDestination(mode)).toBe('/mint');
	});
	it('keeps a service that is not connected neutral', () => {
		const rows = onboardingReview([onboardingConfiguration(ServiceKind.Lightning)], {});
		expect(rows[1]).toEqual(jasmine.objectContaining({status: 'Skipped', tone: 'neutral', enabled: false}));
		expect(rows[1].detail).toContain('own backend');
	});
	it('reports the applied status, environment values and an untested saved connection', () => {
		const mint = onboardingConfiguration(ServiceKind.Mint, true, 'orchard');
		const check = {ok: true, warning: true, saved: true, title: 'Database unavailable', context: '', fields: [], mode: 'setup'};
		const warning = onboardingReview([{...mint, status: 'warning'}], {mint: {saved_check: check}})[2];
		expect(warning).toEqual(jasmine.objectContaining({status: 'Connected with a warning', tone: 'warning'}));
		expect(warning.detail).toBe('CDK · localhost:8091 · federation setup mode');
		expect(onboardingReview([{...mint, status: 'unreachable'}], {})[2].status).toBe('Saved without a working connection');
		expect(onboardingReview([{...mint, source: 'environment'}], {})[2].status).toBe('From environment');
		expect(onboardingReview([mint], {})[2].status).toBe('Saved in Orchard · not tested this session');
	});
	it('does not describe the applied connection with an unsaved draft test', () => {
		const mint = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const check = {ok: true, warning: false, saved: false, title: 'Connected', context: '', fields: [], mode: 'member'};
		expect(onboardingReview([mint], {mint: {check}})[2].detail).not.toContain('federation member');
	});
});
