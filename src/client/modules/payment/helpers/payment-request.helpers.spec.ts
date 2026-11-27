/* Local Dependencies */
import {isPaymentRequest} from './payment-request.helpers';

/* NUT-18's and NUT-26's examples */
const CREQ_A =
	'creqApWF0gaNhdGVub3N0cmFheKlucHJvZmlsZTFxeTI4d3VtbjhnaGo3dW45ZDNzaGp0bnl2OWtoMnVld2Q5aHN6OW1od2RlbjV0ZTB3ZmprY2N0ZTljdXJ4dmVuOWVlaHFjdHJ2NWhzenJ0aHdkZW41dGUwZGVoaHh0bnZkYWtxcWd5ZGFxeTdjdXJrNDM5eWtwdGt5c3Y3dWRoZGh1NjhzdWNtMjk1YWtxZWZkZWhrZjBkNDk1Y3d1bmw1YWeBgmFuYjE3YWloYjdhOTAxNzZhYQphdWNzYXRhbYF4Imh0dHBzOi8vbm9mZWVzLnRlc3RudXQuY2FzaHUuc3BhY2U=';
const CREQ_B =
	'CREQB1QYQQWER9D4HNZV3NQGQQSQQQQQQQQQQRAQPSQQGQQSQQZQG9QQVXSAR5WPEN5TE0D45KUAPWV4UXZMTSD3JJUCM0D5RQQRJRDANXVET9YPCXZ7TDV4H8GXHR3TQ';

describe('PaymentRequestHelpers', () => {
	describe('isPaymentRequest', () => {
		it('recognizes NUT-18 and NUT-26 requests', () => {
			expect(isPaymentRequest(CREQ_A)).toBeTrue();
			expect(isPaymentRequest(CREQ_B)).toBeTrue();
			expect(isPaymentRequest(CREQ_B.toLowerCase())).toBeTrue();
		});

		it('refuses a corrupted NUT-26 request and anything else', () => {
			expect(isPaymentRequest(`${CREQ_B.slice(0, -1)}P`)).toBeFalse();
			expect(isPaymentRequest('creqA')).toBeFalse();
			expect(isPaymentRequest('cashuBo2FteBtodHRwczovL2tlbHAuZXhhbXBsZQ')).toBeFalse();
		});
	});
});
