import {convertToParamMap, type ActivatedRouteSnapshot} from '@angular/router';
import {ServiceKind} from '@shared/generated.types';
import {onboardingDestination, onboardingReview, onboardingRoute, onboardingService} from './onboarding.helpers';
import {onboardingConfiguration} from './onboarding.fixture';

describe('onboarding helpers', () => {
	/** A route snapshot with only the parts the wizard reads. */
	function snapshot(stage: string | null, params: object, query: object): ActivatedRouteSnapshot {
		const firstChild = stage ? {data: {stage}, paramMap: convertToParamMap(params)} : null;
		return {firstChild, queryParamMap: convertToParamMap(query)} as unknown as ActivatedRouteSnapshot;
	}

	it('only accepts supported direct links and sends members to their dashboard', () => {
		expect(onboardingService('taproot')).toBeNull();
		expect(onboardingService('ecash')).toBeNull();
		expect(onboardingService('mint')).toBe(ServiceKind.Mint);
		expect(onboardingDestination('member')).toBe('/mint/federation');
		for (const mode of ['standalone', 'setup', 'unreachable', null]) expect(onboardingDestination(mode)).toBe('/mint');
	});
	it('reads the step, picked services in configuration order, and the return target from the URL', () => {
		expect(
			onboardingRoute(snapshot('configure', {service: 'lightning'}, {picked: 'mint,ecash,taproot,bitcoin', return: 'review'})),
		).toEqual({
			stage: 'configure',
			service: ServiceKind.Lightning,
			picked: [ServiceKind.Bitcoin, ServiceKind.Mint, 'ecash'],
			return_to_review: true,
		});
		expect(onboardingRoute(snapshot('configure', {service: 'taproot'}, {}))).toEqual(
			jasmine.objectContaining({stage: 'services', service: null, picked: null}),
		);
		expect(onboardingRoute(snapshot('configure', {service: 'ecash'}, {}))).toEqual(
			jasmine.objectContaining({stage: 'services', service: null}),
		);
		expect(onboardingRoute(snapshot('review', {}, {picked: ''}))).toEqual(jasmine.objectContaining({stage: 'review', picked: []}));
		expect(onboardingRoute(snapshot(null, {}, {})).stage).toBe('services');
	});
	it('keeps a service that is not connected neutral', () => {
		const rows = onboardingReview([onboardingConfiguration(ServiceKind.Lightning)], {}, false);
		expect(rows[1]).toEqual(jasmine.objectContaining({status: 'Skipped', tone: 'neutral', enabled: false}));
		expect(rows[1].detail).toContain('own backend');
	});
	it('lists the ecash wallet last, as enabled or skipped', () => {
		expect(onboardingReview([], {}, true).at(-1)).toEqual(
			jasmine.objectContaining({
				service: 'ecash',
				status: 'Enabled',
				tone: 'success',
				enabled: true,
				detail: 'Works with any mint',
				action: 'Turn off',
			}),
		);
		expect(onboardingReview([], {}, false).at(-1)).toEqual(
			jasmine.objectContaining({service: 'ecash', status: 'Skipped', tone: 'neutral', enabled: false, action: 'Turn on'}),
		);
	});
	it('reports the applied status, environment values and an untested saved connection', () => {
		const mint = onboardingConfiguration(ServiceKind.Mint, true, 'orchard');
		const check = {ok: true, warning: true, saved: true, title: 'Database unavailable', context: '', fields: [], mode: 'setup'};
		const warning = onboardingReview([{...mint, status: 'warning'}], {mint: {saved_check: check}}, false)[2];
		expect(warning).toEqual(jasmine.objectContaining({status: 'Connected with a warning', tone: 'warning'}));
		expect(warning.detail).toBe('CDK · localhost:8091 · without mTLS · Federation setup');
		expect(onboardingReview([{...mint, status: 'unreachable'}], {}, false)[2].status).toBe('Saved without a working connection');
		expect(onboardingReview([{...mint, source: 'environment'}], {}, false)[2].status).toBe('From environment');
		expect(onboardingReview([mint], {}, false)[2].status).toBe('Saved in Orchard · not tested this session');
	});
	it('does not describe the applied connection with an unsaved draft test', () => {
		const mint = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const check = {ok: true, warning: false, saved: false, title: 'Connected', context: '', fields: [], mode: 'member'};
		expect(onboardingReview([mint], {mint: {check}}, false)[2].detail).not.toContain('Federation member');
	});
});
