/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

@Component({
	selector: 'orc-graphic-asset',
	standalone: false,
	templateUrl: './graphic-asset.component.html',
	styleUrl: './graphic-asset.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphicAssetComponent {
	public unit = input.required<string>();
	public height = input<string>('2rem');
	public custody = input<'ecash' | 'lightning' | 'hot' | 'cold' | null>(null);
	public group_key = input<string | undefined>(undefined);

	public lower_unit = computed(() => {
		return this.unit().toLowerCase();
	});

	public unit_icon = computed(() => {
		const unit = this.lower_unit();
		if (unit === 'sat') return 'currency_bitcoin';
		if (unit === 'msat') return 'currency_bitcoin';
		if (unit === 'btc') return 'currency_bitcoin';
		if (unit === 'usd') return 'attach_money';
		if (unit === 'eur') return 'euro';
		return 'money_bag';
	});

	public unit_icon_size = computed(() => {
		const height_value = parseFloat(this.height());
		return (isNaN(height_value) ? 2 : height_value) * 0.75 + 'rem';
	});

	public unit_class = computed(() => {
		const unit = this.lower_unit();
		if (unit === 'sat') return 'graphic-asset-btc';
		if (unit === 'msat') return 'graphic-asset-btc';
		if (unit === 'btc') return 'graphic-asset-btc';
		if (unit === 'usd') return 'graphic-asset-usd';
		if (unit === 'eur') return 'graphic-asset-eur';
		return 'graphic-asset-unknown';
	});

	public custody_icon = computed(() => {
		const custody = this.custody();
		if (!custody) return 'payments';
		if (custody === 'ecash') return 'payments';
		if (custody === 'lightning') return 'bolt';
		if (custody === 'hot') return 'mode_heat';
		if (custody === 'cold') return 'ac_unit';
		return 'payments';
	});

	public custody_icon_size = computed(() => {
		const height_value = parseFloat(this.height());
		return (isNaN(height_value) ? 2 : height_value) * 0.7 + 'rem';
	});

	public supported_taproot_asset = computed(() => {
		const group_key = this.group_key();
		if (!group_key) return false;
		return this.taproot_assets_map.has(group_key);
	});

	public taproot_asset_image = computed(() => {
		const group_key = this.group_key();
		if (!group_key) return '';
		return `taproot-assets/${this.taproot_assets_map.get(group_key)}`;
	});

	private taproot_assets_map: Map<string, string>;

	constructor(private configService: ConfigService) {
		this.taproot_assets_map = new Map<string, string>([[this.configService.config.constants.taproot_group_keys['usdt'], 'tether.svg']]);
	}
}
