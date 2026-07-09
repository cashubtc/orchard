/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {parsePrometheusText, canonicalizeLabels, parseCanonicalLabels, flattenFamily} from './prometheus.helpers';

/** Trimmed fixture copied from a live cdk-mintd /metrics response */
const CDK_METRICS_FIXTURE = `# HELP cdk_auth_attempts_total Total authentication attempts
# TYPE cdk_auth_attempts_total counter
cdk_auth_attempts_total 0
# HELP cdk_db_connections_active Number of active database connections
# TYPE cdk_db_connections_active gauge
cdk_db_connections_active 3
# HELP cdk_mint_in_flight_requests Number of in-flight mint requests
# TYPE cdk_mint_in_flight_requests gauge
cdk_mint_in_flight_requests{operation="get_settings"} 0
cdk_mint_in_flight_requests{operation="wait_payment_event"} 1
# HELP cdk_mint_operations_total Total number of mint operations
# TYPE cdk_mint_operations_total counter
cdk_mint_operations_total{operation="get_settings",status="success"} 3
cdk_mint_operations_total{operation="transaction_rollback",status="success"} 15
# HELP cdk_mint_operation_duration_seconds Duration of mint operations in seconds
# TYPE cdk_mint_operation_duration_seconds histogram
cdk_mint_operation_duration_seconds_bucket{operation="get_settings",status="success",le="0.005"} 3
cdk_mint_operation_duration_seconds_bucket{operation="get_settings",status="success",le="+Inf"} 3
cdk_mint_operation_duration_seconds_sum{operation="get_settings",status="success"} 0.000019666
cdk_mint_operation_duration_seconds_count{operation="get_settings",status="success"} 3
# HELP process_memory_bytes Memory usage of the CDK process in bytes
# TYPE process_memory_bytes gauge
process_memory_bytes 40730624
`;

describe('parsePrometheusText', () => {
	it('parses unlabeled counters and gauges', () => {
		const families = parsePrometheusText(CDK_METRICS_FIXTURE);
		const counter = families.find((f) => f.name === 'cdk_auth_attempts_total');
		const gauge = families.find((f) => f.name === 'cdk_db_connections_active');
		expect(counter).toEqual({name: 'cdk_auth_attempts_total', type: 'counter', samples: [{labels: {}, value: 0}]});
		expect(gauge?.type).toBe('gauge');
		expect(gauge?.samples).toEqual([{labels: {}, value: 3}]);
	});

	it('parses labeled samples into one family', () => {
		const families = parsePrometheusText(CDK_METRICS_FIXTURE);
		const in_flight = families.find((f) => f.name === 'cdk_mint_in_flight_requests');
		expect(in_flight?.samples).toEqual([
			{labels: {operation: 'get_settings'}, value: 0},
			{labels: {operation: 'wait_payment_event'}, value: 1},
		]);
		const operations = families.find((f) => f.name === 'cdk_mint_operations_total');
		expect(operations?.samples).toHaveLength(2);
		expect(operations?.samples[1]).toEqual({labels: {operation: 'transaction_rollback', status: 'success'}, value: 15});
	});

	it('collects histogram sum, count and bucket samples', () => {
		const families = parsePrometheusText(CDK_METRICS_FIXTURE);
		const histogram = families.find((f) => f.name === 'cdk_mint_operation_duration_seconds');
		expect(histogram?.type).toBe('histogram');
		expect(histogram?.samples).toEqual([]);
		expect(histogram?.sum_samples).toEqual([{labels: {operation: 'get_settings', status: 'success'}, value: 0.000019666}]);
		expect(histogram?.count_samples).toEqual([{labels: {operation: 'get_settings', status: 'success'}, value: 3}]);
		expect(histogram?.bucket_samples).toEqual([
			{labels: {operation: 'get_settings', status: 'success', le: '0.005'}, value: 3},
			{labels: {operation: 'get_settings', status: 'success', le: '+Inf'}, value: 3},
		]);
	});

	it('unescapes quoted label values', () => {
		const families = parsePrometheusText('# TYPE demo gauge\ndemo{path="a\\"b",note="line\\nbreak",slash="c\\\\d"} 1\n');
		expect(families[0].samples[0].labels).toEqual({path: 'a"b', note: 'line\nbreak', slash: 'c\\d'});
	});

	it('skips non-finite values and samples without a TYPE line', () => {
		const families = parsePrometheusText('orphan_metric 5\n# TYPE demo gauge\ndemo NaN\ndemo +Inf\ndemo 2\n');
		expect(families).toHaveLength(1);
		expect(families[0].samples).toEqual([{labels: {}, value: 2}]);
	});
});

describe('flattenFamily', () => {
	it('groups histogram buckets per label set, stripping le and omitting +Inf', () => {
		const families = parsePrometheusText(CDK_METRICS_FIXTURE);
		const histogram = families.find((f) => f.name === 'cdk_mint_operation_duration_seconds');
		const series = flattenFamily(histogram!);
		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({
			labels: 'operation=get_settings,status=success',
			sum: 0.000019666,
			count: 3,
			buckets: {'0.005': 3},
		});
	});

	it('sets buckets null for gauge and counter families', () => {
		const families = parsePrometheusText(CDK_METRICS_FIXTURE);
		const gauge = flattenFamily(families.find((f) => f.name === 'cdk_db_connections_active')!);
		const counter = flattenFamily(families.find((f) => f.name === 'cdk_mint_operations_total')!);
		expect(gauge[0].buckets).toBeNull();
		expect(counter[0].buckets).toBeNull();
	});
});

describe('canonicalizeLabels', () => {
	it('sorts keys and joins pairs', () => {
		expect(canonicalizeLabels({status: 'success', operation: 'swap'})).toBe('operation=swap,status=success');
	});

	it('returns an empty string for unlabeled samples', () => {
		expect(canonicalizeLabels({})).toBe('');
	});
});

describe('parseCanonicalLabels', () => {
	it('round-trips a canonical string', () => {
		expect(parseCanonicalLabels('operation=swap,status=success')).toEqual([
			{name: 'operation', value: 'swap'},
			{name: 'status', value: 'success'},
		]);
	});

	it('returns an empty array for the empty string', () => {
		expect(parseCanonicalLabels('')).toEqual([]);
	});
});
