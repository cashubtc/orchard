/* Core Dependencies */
import {ChangeDetectionStrategy, Component, effect, input, output, signal, computed, viewChild} from '@angular/core';
/* Vendor Dependencies */
import {MatSort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
/* Application Dependencies */
import {NonNullableMintKeysetsSettings} from '@client/modules/settings/types/setting.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';
import {MintSubsectionKeysetsTableRow} from '@client/modules/mint/modules/mint-subsection-keysets/classes/mint-subsection-keysets-table-row.class';

@Component({
	selector: 'orc-mint-subsection-keysets-table',
	standalone: false,
	templateUrl: './mint-subsection-keysets-table.component.html',
	styleUrl: './mint-subsection-keysets-table.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionKeysetsTableComponent {
	readonly sort = viewChild(MatSort);

	readonly keysets = input.required<MintKeyset[]>();
	readonly keysets_analytics = input.required<MintAnalyticKeyset[]>();
	readonly keysets_analytics_pre = input.required<MintAnalyticKeyset[]>();
	readonly keysets_counts = input.required<MintKeysetCount[]>();
	readonly page_settings = input.required<NonNullableMintKeysetsSettings>();
	readonly loading = input.required<boolean>();
	readonly device_type = input.required<DeviceType>();
	readonly bitcoin_oracle_data = input.required<{balance_cents: number; fees_cents: number; date: number} | null>();

	readonly rotateKeyset = output<string>();
	readonly highlightChange = output<string | null>();
	readonly moreRequest = output<MintSubsectionKeysetsTableRow>();

	readonly data_source = signal(new MatTableDataSource<MintSubsectionKeysetsTableRow>([]));
	public more_entity = signal<MintSubsectionKeysetsTableRow | null>(null);

	public displayed_columns = computed(() => {
		const device_type = this.device_type();
		if (device_type === 'mobile') return ['keyset'];
		if (device_type === 'tablet') return ['keyset', 'input_fee_ppk', 'valid_from', 'balance'];
		return ['keyset', 'id', 'input_fee_ppk', 'valid_from', 'balance', 'fees_paid', 'proof_count', 'promise_count', 'actions'];
	});

	constructor() {
		effect(() => {
			if (this.loading()) return;
			this.init();
		});

		effect(() => {
			const sort = this.sort();
			const source = this.data_source();
			if (sort && source.data.length) {
				source.sort = sort;
			}
		});
	}

	/**
	 * Initializes the data source with filtered and sorted keyset rows
	 */
	private init(): void {
		const status_filter = this.page_settings()?.status ?? [];
		const units_filter = this.page_settings()?.units ?? [];
		const keyset_rows = this.keysets()
			.filter((keyset) => keyset.valid_from == null || this.page_settings()?.date_end >= keyset.valid_from)
			.filter((keyset) => !status_filter.length || status_filter.includes(keyset.active))
			.filter((keyset) => !units_filter.length || units_filter.includes(keyset.unit))
			.sort((a, b) => b.derivation_path_index - a.derivation_path_index)
			.map((keyset) => {
				const keyset_analytics = this.keysets_analytics().filter((analytic) => analytic.keyset_id === keyset.id);
				const keyset_analytics_pre = this.keysets_analytics_pre().filter((analytic) => analytic.keyset_id === keyset.id);
				const keyset_count = this.keysets_counts().find((kc) => kc.id === keyset.id);
				return new MintSubsectionKeysetsTableRow(keyset, keyset_analytics, keyset_analytics_pre, keyset_count);
			});

		this.data_source.set(new MatTableDataSource(keyset_rows));
	}

	/**
	 * Toggles the expanded detail row for an entity
	 * @param entity - the keyset to toggle
	 */
	public toggleMore(entity: MintSubsectionKeysetsTableRow): void {
		this.more_entity.set(this.more_entity() === entity ? null : entity);
		this.highlightChange.emit(this.more_entity()?.id ?? null);
		const expanded = this.more_entity();
		if (expanded) this.moreRequest.emit(expanded);
	}

	/**
	 * Emits highlight for the hovered row
	 * @param entity - the hovered keyset row
	 */
	public onRowHover(entity: MintSubsectionKeysetsTableRow): void {
		this.highlightChange.emit(entity.id);
	}

	/**
	 * Reverts highlight to expanded row on mouse leave, or clears it
	 */
	public onRowLeave(): void {
		this.highlightChange.emit(this.more_entity()?.id ?? null);
	}
}
