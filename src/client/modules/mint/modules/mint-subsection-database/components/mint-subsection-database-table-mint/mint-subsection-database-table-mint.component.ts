/* Core Dependencies */
import {ChangeDetectionStrategy, Component, ElementRef, input, computed, AfterViewInit, ViewChild, output} from '@angular/core';
/* Vendor Dependencies */
import QRCodeStyling from 'qr-code-styling';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {ThemeService} from '@client/modules/settings/services/theme/theme.service';
import {LightningRequest} from '@client/modules/lightning/classes/lightning-request.class';
/* Native Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
/* Shared Dependencies */
import {MintQuoteState} from '@shared/generated.types';

enum ExpiredState {
	NONE = 'None',
	PAID = 'PAID',
	EXPIRED = 'EXPIRED',
}

@Component({
	selector: 'orc-mint-subsection-database-table-mint',
	standalone: false,
	templateUrl: './mint-subsection-database-table-mint.component.html',
	styleUrl: './mint-subsection-database-table-mint.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDatabaseTableMintComponent implements AfterViewInit {
	@ViewChild('qr_canvas', {static: false}) qr_canvas!: ElementRef;

	public quote = input.required<MintMintQuote>();
	public loading = input.required<boolean>();
	public lightning_request = input<LightningRequest | null>(null);
	public bitcoin_oracle_data = input.required<{price_cents: number; date: number} | null>();
	public device_desktop = input.required<boolean>();

	public setStatePaid = output<MintMintQuote>();

	public qr_code!: QRCodeStyling;

	public can_set_paid = computed(() => {
		return this.quote().state === MintQuoteState.Unpaid;
	});

	public request_label = computed(() => {
		switch (this.quote().payment_method) {
			case 'bolt11':
				return 'Bolt 11 Invoice';
			case 'bolt12':
				return 'Bolt 12 Offer';
			case 'onchain':
				return 'Onchain Address';
			default:
				return 'Payment Request';
		}
	});

	private expired_state = computed((): ExpiredState => {
		const lr = this.lightning_request();
		const quote = this.quote();
		if (!lr) return ExpiredState.NONE;
		if (!lr.expiry) return ExpiredState.NONE;
		if (quote.state === MintQuoteState.Paid || quote.state === MintQuoteState.Issued) return ExpiredState.PAID;
		const now_seconds = DateTime.utc().toUnixInteger();
		if (quote.state === MintQuoteState.Unpaid && now_seconds > lr.expiry) return ExpiredState.EXPIRED;
		return ExpiredState.NONE;
	});

	public expired_message = computed(() => {
		const expired_state = this.expired_state();
		if (expired_state === ExpiredState.PAID) return 'Paid before expiry';
		if (expired_state === ExpiredState.EXPIRED) return 'Expired before paid';
		return '';
	});

	public expired_class = computed(() => {
		const expired_state = this.expired_state();
		if (expired_state === ExpiredState.PAID) return 'orc-outline-color';
		if (expired_state === ExpiredState.EXPIRED) return 'orc-status-warning-color';
		return '';
	});

	constructor(private themeService: ThemeService) {}

	ngAfterViewInit(): void {
		this.initQR();
	}

	private initQR(): void {
		const qr_primary_color = this.themeService.getThemeColor('--mat-sys-surface') || '#000000';
		const qr_corner_dot_color = this.themeService.getThemeColor('--mat-sys-surface-container-highest') || '#000000';

		this.qr_code = new QRCodeStyling({
			width: 195,
			height: 195,
			type: 'svg',
			data: this.quote().request,
			image: undefined,
			shape: 'square',
			margin: 0,
			qrOptions: {
				typeNumber: 0,
				mode: 'Byte',
				errorCorrectionLevel: 'Q',
			},
			dotsOptions: {
				color: qr_primary_color,
				type: 'extra-rounded',
			},
			backgroundOptions: {
				color: undefined,
			},
			cornersSquareOptions: {
				color: qr_primary_color,
				type: 'extra-rounded',
			},
			cornersDotOptions: {
				color: qr_corner_dot_color,
				type: 'square',
			},
		});

		this.qr_code.append(this.qr_canvas.nativeElement);
	}

	public onSetStatePaid(event: Event): void {
		event.stopPropagation();
		event.preventDefault();
		this.setStatePaid.emit(this.quote());
	}
}
