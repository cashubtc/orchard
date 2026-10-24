import {
	hasOnchainCustody,
	isDevelopment,
	paymentRule,
	paymentBackend,
	readinessLabel,
	statusLabel,
	syncLabel,
	timestamp,
} from '@client/modules/federation/helpers/federation-status.helpers';
import {federationInfo, barkWallet, bdkWallet, localStatus} from '@client/modules/federation/helpers/federation-status.fixtures';
describe('Federation status helpers', () => {
	it('only identifies development when the policy explicitly says so, for either direction', () => {
		const info = federationInfo();
		expect(isDevelopment(info)).toBeFalse();
		info.payment_observation_policy!.melt_quotes!.kind = 'PAYMENT_VERIFICATION_POLICY_KIND_DEVELOPMENT_SINGLE_OBSERVATION';
		expect(isDevelopment(info)).toBeTrue();
		expect(paymentRule(info.payment_observation_policy!.mint_quotes)).toContain('3 members');
		expect(paymentRule(info.payment_observation_policy!.melt_quotes)).toContain('development');
	});
	it('attributes methods only from custody evidence', () => {
		const custody = {onchain_wallets: [], bark: barkWallet(), wallet_operator: bdkWallet()};
		expect(paymentBackend('bolt11', custody)).toContain('Bark');
		expect(paymentBackend('onchain', custody)).toContain('BDK');
		expect(paymentBackend('bolt12', custody)).toBe('Backend not reported');
		expect(paymentBackend('bolt11', null)).toBe('Backend not reported');
		expect(paymentBackend('bolt11', {onchain_wallets: []})).toContain('No custody reported');
	});
	it('counts any federated BDK section as on-chain custody', () => {
		expect(hasOnchainCustody({onchain_wallets: []})).toBeFalse();
		expect(hasOnchainCustody({onchain_wallets: [], bark: barkWallet()})).toBeFalse();
		const liveness = {
			activity: 'WALLET_LIVENESS_ACTIVITY_IDLE',
			awaiting_signatures: '0',
			pending_batches: '0',
			proposal_attempts: '0',
			signer_failures: '0',
			signing_attempts: '0',
		};
		expect(hasOnchainCustody({onchain_wallets: [], wallet_liveness: liveness})).toBeTrue();
	});
	it('never calls a halted mint healthy or serving', () => {
		const status = localStatus().status!;
		expect(syncLabel(status)).toBe('Healthy');
		expect(readinessLabel(status)).toBe('Serving wallets');
		status.checkpoint!.audit_mismatch = true;
		expect(syncLabel(status)).toBe('Halted');
		expect(readinessLabel(status)).toBe('Not serving wallets');
		expect(readinessLabel(null)).toBe('Readiness not reported');
	});
	it('preserves unknown enum strings and refuses invalid timestamps', () => {
		expect(statusLabel('FUTURE_STATE')).toBe('FUTURE_STATE');
		expect(timestamp('18446744073709551615')).toBeNull();
		expect(timestamp('1700000000')).toBe(1700000000);
	});
});
