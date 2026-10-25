import {normalizeFederationEnums} from '#server/modules/federation/helpers/federation-enums.helpers';
import {FEDERATION_ABSENT_ENUMS} from '#server/modules/federation/constants/federation.constants';

describe('Federation enum boundary', () => {
	it.each(FEDERATION_ABSENT_ENUMS)('treats %s as absent, including nested peer and custody sections', (value) => {
		expect(normalizeFederationEnums({members: [{status: {sync: {state: value}}}], bark: null})).toEqual({
			members: [{status: {sync: {state: undefined}}}],
			bark: null,
		});
	});
	it('preserves future values, existing enums, exact counters and null sections', () => {
		const data = {phase: 'FUTURE_PHASE', state: 'SYNC_STATE_HEALTHY', counter: '18446744073709551615', dkg: null};
		expect(normalizeFederationEnums(data)).toEqual(data);
	});
});
