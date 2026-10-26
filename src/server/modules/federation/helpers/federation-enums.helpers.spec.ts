import {normalizeFederationEnums} from '#server/modules/federation/helpers/federation-enums.helpers';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';

const absent_enums = readdirSync('proto/cdk')
	.filter((file) => file.endsWith('.proto'))
	.flatMap((file) =>
		[...readFileSync(path.join('proto/cdk', file), 'utf8').matchAll(/(\w+_UNSPECIFIED)\s*=\s*0/g)].map((match) => match[1]),
	);

describe('Federation enum boundary', () => {
	it.each([...absent_enums, 'FUTURE_ENUM_UNSPECIFIED'])('treats %s as absent, including nested peer and custody sections', (value) => {
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
