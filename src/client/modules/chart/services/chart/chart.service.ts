/* Core Dependencies */
import {Injectable} from '@angular/core';
/* Vendor Dependencies */
import {Observable, Subject} from 'rxjs';
import {Plugin} from 'chart.js';
/* Application Dependencies */
import {DataType} from '@client/modules/orchard/enums/data.enum';
import {ThemeService} from '@client/modules/settings/services/theme/theme.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {CurrencyType} from '@client/modules/cache/services/local-storage/local-storage.types';
import {eligibleForOracleConversion} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {OracleChartDataPoint} from '@client/modules/chart/types/chart.types';
/* Shared Dependencies */
import {MintQuoteState, MeltQuoteState} from '@shared/generated.types';

@Injectable({
	providedIn: 'root',
})
export class ChartService {
	private asset_map: Record<string, string> = {
		sat: '--orc-asset-btc',
		usd: '--orc-asset-usd',
		eur: '--orc-asset-eur',
	};
	private fallback_colors = [
		{bg: 'rgba(255, 253, 159, 0.15)', border: 'rgb(255, 253, 159)'},
		{bg: 'rgba(255, 214, 31, 0.15)', border: 'rgb(255, 214, 31)'},
		{bg: 'rgba(245, 143, 34, 0.15)', border: 'rgb(245, 143, 34)'},
		{bg: 'rgba(243, 101, 29, 0.15)', border: 'rgb(243, 101, 29)'},
		{bg: 'rgba(156, 34, 34, 0.15)', border: 'rgb(156, 34, 34)'},
	];
	private state_mint_map = {
		UNPAID: 'triangle',
		PAID: 'rect',
		PENDING: 'rectRot',
		ISSUED: 'circle',
	};
	private state_melt_map = {
		UNPAID: 'triangle',
		PENDING: 'rectRot',
		PAID: 'circle',
	};
	private resize_start_subject = new Subject<void>();
	private resize_end_subject = new Subject<void>();

	constructor(
		private themeService: ThemeService,
		private settingDeviceService: SettingDeviceService,
	) {}

	public getAssetColor(asset: string, data_index: number): {bg: string; border: string} {
		const theme = this.settingDeviceService.getTheme();
		const asset_lower = asset.toLowerCase();
		const color_var = this.asset_map[asset_lower];
		if (color_var === undefined) return this.fallback_colors[data_index % this.fallback_colors.length];
		const colorhex = this.themeService.getThemeColor(color_var, theme);
		const colorrgba = this.hexToRgba(colorhex, 0.15);
		return {bg: colorrgba, border: colorhex};
	}

	public getThemeColor(index: number): {bg: string; border: string} {
		return this.fallback_colors[index];
	}

	public getPointHoverBackgroundColor(): string {
		const theme = this.settingDeviceService.getTheme();
		const colorhex = this.themeService.getThemeColor('--mat-sys-surface', theme);
		return colorhex;
	}

	public getGridColor(token: string = '--mat-sys-surface-container'): string {
		const theme = this.settingDeviceService.getTheme();
		const colorhex = this.themeService.getThemeColor(token, theme);
		return colorhex;
	}

	public getAnnotationBorderColor(): string {
		const theme = this.settingDeviceService.getTheme();
		const colorhex = this.themeService.getThemeColor('--mat-sys-outline', theme);
		return colorhex;
	}

	public getFormAnnotationConfig(hot: boolean): any {
		const theme = this.settingDeviceService.getTheme();
		if (hot)
			return {
				border_color: this.themeService.getThemeColor('--mat-sys-primary', theme),
				border_width: 2,
				text_color: this.themeService.getThemeColor('--mat-sys-primary', theme),
				label_bg_color: this.themeService.getThemeColor('--mat-sys-inverse-primary', theme),
				label_border_color: this.themeService.getThemeColor('--mat-sys-surface-container-low', theme),
			};
		return {
			border_color: this.themeService.getThemeColor('--mat-sys-outline-variant', theme),
			border_width: 1,
			text_color: this.themeService.getThemeColor('--mat-sys-on-surface-variant', theme),
			label_bg_color: this.themeService.getThemeColor('--mat-sys-surface-container-low', theme),
			label_border_color: this.themeService.getThemeColor('--mat-sys-outline-variant', theme),
		};
	}

	public getStatePointStyle(datatype: DataType, state: string | undefined): string {
		if (datatype === DataType.MintMints) return this.state_mint_map[state as MintQuoteState] || 'circle';
		if (datatype === DataType.MintMelts) return this.state_melt_map[state as MeltQuoteState] || 'circle';
		return 'circle';
	}

	public hexToRgba(hex: string, opacity: number): string {
		hex = hex.replace('#', '');
		let r, g, b;
		if (hex.length === 3) {
			r = parseInt(hex.substring(0, 1).repeat(2), 16);
			g = parseInt(hex.substring(1, 2).repeat(2), 16);
			b = parseInt(hex.substring(2, 3).repeat(2), 16);
		} else {
			r = parseInt(hex.substring(0, 2), 16);
			g = parseInt(hex.substring(2, 4), 16);
			b = parseInt(hex.substring(4, 6), 16);
		}
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

	public triggerResizeStart(): void {
		this.resize_start_subject.next();
	}
	public triggerResizeEnd(): void {
		this.resize_end_subject.next();
	}
	public onResizeStart(): Observable<void> {
		return this.resize_start_subject.asObservable();
	}
	public onResizeEnd(): Observable<void> {
		return this.resize_end_subject.asObservable();
	}

	/**
	 * Converts rgb() string to hex format
	 */
	public rgbToHex(rgb: string): string {
		const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (!match) return '#ffffff';
		const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
		const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
		const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
		return `#${r}${g}${b}`;
	}

	/**
	 * Gets a muted version of a color with specified opacity
	 */
	public getMutedColor(border_color: string, opacity: number = 0.6): string {
		const hex_color = border_color.startsWith('#') ? border_color : this.rgbToHex(border_color);
		return this.hexToRgba(hex_color, opacity);
	}

	/**
	 * Creates a vertical gradient for chart area fill (fades from bottom to top)
	 */
	public createAreaGradient(
		context: any,
		border_color: string,
		top_opacity: number = 0.01,
		bottom_opacity: number = 0.2,
	): CanvasGradient | string {
		const chart = context.chart;
		const {ctx, chartArea} = chart;
		if (!chartArea) return 'transparent';
		const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
		const hex_color = border_color.startsWith('#') ? border_color : this.rgbToHex(border_color);
		const rgba_top = this.hexToRgba(hex_color, top_opacity);
		const rgba_bottom = this.hexToRgba(hex_color, bottom_opacity);
		gradient.addColorStop(0, rgba_top);
		gradient.addColorStop(1, rgba_bottom);
		return gradient;
	}

	/**
	 * Creates a diagonal stripe canvas pattern for chart fills
	 */
	public createStripePattern(color: string, stripe_width: number = 4, gap: number = 6, opacity: number = 0.3): CanvasPattern | string {
		const canvas = document.createElement('canvas');
		const size = stripe_width + gap;
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) return 'transparent';

		const hex_color = color.startsWith('#') ? color : this.rgbToHex(color);
		const stripe_color = this.hexToRgba(hex_color, opacity);

		ctx.strokeStyle = stripe_color;
		ctx.lineWidth = stripe_width;
		ctx.beginPath();
		ctx.moveTo(0, size);
		ctx.lineTo(size, 0);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(-size, size);
		ctx.lineTo(size, -size);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, size * 2);
		ctx.lineTo(size * 2, 0);
		ctx.stroke();

		const pattern = ctx.createPattern(canvas, 'repeat');
		return pattern || 'transparent';
	}

	/**
	 * Creates a glow effect plugin for chart points
	 */
	public createGlowPlugin(border_color: string, opacity: number = 0.35, blur: number = 10): Plugin {
		const hex_color = border_color.startsWith('#') ? border_color : this.rgbToHex(border_color);
		const glow_color = this.hexToRgba(hex_color, opacity);
		return {
			id: 'pointGlow',
			beforeDatasetsDraw: (chart: any) => {
				const ctx = chart.ctx;
				ctx.save();
				ctx.shadowColor = glow_color;
				ctx.shadowBlur = blur;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;
			},
			afterDatasetsDraw: (chart: any) => {
				chart.ctx.restore();
			},
		};
	}

	/**
	 * Formats an amount for display in chart tooltips, respecting user locale and currency preferences
	 */
	public formatTooltipAmount(amount: number, unit: string): string {
		const locale = this.settingDeviceService.getLocale();
		const currency = this.settingDeviceService.getCurrency();
		const unit_lower = unit.toLowerCase();

		switch (unit_lower) {
			case 'msat':
				return this.formatBtcAmount(Math.ceil(amount / 1000), locale, currency.type_btc);
			case 'sat':
				return this.formatBtcAmount(amount, locale, currency.type_btc);
			case 'btc':
				return this.formatBtcFull(amount, locale);
			case 'usd':
			case 'eur':
				return this.formatFiatAmount(amount, unit, locale, currency.type_fiat);
			default:
				return amount.toLocaleString(locale);
		}
	}

	/**
	 * Formats a tooltip label for oracle chart data points
	 */
	public formatOracleTooltipLabel(context: any, oracle_used: boolean): string {
		const label = context.dataset.label || '';
		const raw_point = context.raw as OracleChartDataPoint;

		if (raw_point && 'y_original' in raw_point) {
			const original = raw_point.y_original;
			const converted = raw_point.y_converted;
			const unit = raw_point.unit;

			const formatted_original = this.formatTooltipAmount(original, unit);

			if (oracle_used && converted !== null && eligibleForOracleConversion(unit)) {
				const formatted_converted = this.formatFiatAmount(
					converted / 100,
					'usd',
					this.settingDeviceService.getLocale(),
					this.settingDeviceService.getCurrency().type_fiat,
				);
				return `${label}: ${formatted_original} (${formatted_converted})`;
			}

			return `${label}: ${formatted_original}`;
		}

		return `${label}: ${context.parsed.y.toLocaleString(this.settingDeviceService.getLocale())}`;
	}

	private formatBtcAmount(amount: number, locale: string, currency_type: CurrencyType): string {
		const formatted = amount.toLocaleString(locale);
		return currency_type === CurrencyType.GLYPH ? `₿${formatted}` : `${formatted} sat`;
	}

	private formatBtcFull(amount: number, locale: string): string {
		return `${amount.toLocaleString(locale, {minimumFractionDigits: 8, maximumFractionDigits: 8})} BTC`;
	}

	private formatFiatAmount(amount: number, unit: string, locale: string, currency_type: CurrencyType): string {
		const formatted = amount.toLocaleString(locale, {minimumFractionDigits: 2, maximumFractionDigits: 2});
		if (currency_type === CurrencyType.GLYPH) {
			const symbol = unit.toLowerCase() === 'eur' ? '€' : '$';
			return `${symbol}${formatted}`;
		}
		return `${formatted} ${unit.toUpperCase()}`;
	}
}
