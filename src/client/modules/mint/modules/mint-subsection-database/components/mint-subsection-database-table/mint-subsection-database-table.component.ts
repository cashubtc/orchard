/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, effect, input, output, ViewChild} from '@angular/core';
/* Vendor Dependencies */
import {MatSort} from '@angular/material/sort';
/* Application Dependencies */
import {NonNullableMintDatabaseSettings} from '@client/modules/settings/types/setting.types';
import {LightningRequest} from '@client/modules/lightning/classes/lightning-request.class';
/* Native Dependencies */
import {MintSubsectionDatabaseData} from '@client/modules/mint/modules/mint-subsection-database/classes/mint-subsection-database-data.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintSwap} from '@client/modules/mint/classes/mint-swap.class';
/* Shared Dependencies */
import {MintQuoteState, MeltQuoteState} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-database-table',
	standalone: false,
	templateUrl: './mint-subsection-database-table.component.html',
	styleUrl: './mint-subsection-database-table.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDatabaseTableComponent {
	public readonly allow_override = input(true);
	@ViewChild(MatSort) sort!: MatSort;

	/* Inputs */
	public data = input.required<MintSubsectionDatabaseData>(); // table data source with type
	public page_settings = input.required<NonNullableMintDatabaseSettings>(); // pagination and filter settings
	public keysets = input.required<MintKeyset[]>(); // available keysets for ecash display
	public loading = input.required<boolean>(); // loading state for initial data
	public loading_more = input.required<boolean>(); // loading state for expanded row details
	public lightning_request = input.required<LightningRequest | null>(); // lightning request for invoice lookup
	public device_desktop = input.required<boolean>(); // mobile view flag
	public bitcoin_oracle_data = input.required<{price_cents: number; date: number} | null>(); // bitcoin oracle data for oracle conversion

	/* Outputs */
	public updateRequest = output<MintMintQuote | MintMeltQuote | MintSwap>(); // emits request string for invoice updates
	public setQuoteStatePaid = output<MintMintQuote | MintMeltQuote>(); // emits quote to mark as paid
	public highlightChange = output<string | null>(); // emits entity id on row toggle, null on collapse

	/* State */
	public more_entity!: MintMintQuote | MintMeltQuote | MintSwap | null; // currently expanded row entity
	public MintQuoteState = MintQuoteState;
	public MeltQuoteState = MeltQuoteState;

	/**
	 * Computes the displayed columns based on the data type
	 * @returns array of column names to display
	 */
	public displayed_columns = computed(() => {
		return this.getDisplayedColumns();
	});

	constructor() {
		effect(() => {
			const is_loading = this.loading();
			if (!is_loading) this.init();
		});
	}

	/**
	 * Initializes the table sort after data has loaded
	 */
	private init(): void {
		setTimeout(() => {
			this.data().source.sort = this.sort;
		});
	}

	private getDisplayedColumns(): string[] {
		const mobile = !this.device_desktop();
		const data_type = this.data().type;
		if (data_type === 'MintMints' || data_type === 'MintMelts') {
			if (mobile) return ['unit', 'amount', 'state'];
			return ['unit', 'amount', 'request', 'state', 'created_time', 'actions'];
		}

		if (data_type === 'MintSwaps') {
			if (mobile) return ['unit', 'amount', 'created_time'];
			return ['unit', 'amount', 'fee', 'created_time'];
		}
		if (mobile) return ['unit', 'amount', 'state'];
		return ['unit', 'amount', 'request', 'state', 'created_time'];
	}

	/**
	 * Toggles the expanded detail row for an entity
	 * @param entity - the entity to toggle
	 */
	public toggleMore(entity: MintMintQuote | MintMeltQuote | MintSwap): void {
		this.more_entity = this.more_entity === entity ? null : entity;
		this.highlightChange.emit(this.more_entity?.id ?? null);
		if (this.more_entity) this.updateRequest.emit(this.more_entity);
	}

	/**
	 * Emits highlight for the hovered row
	 * @param entity - the hovered entity
	 */
	public onRowHover(entity: MintMintQuote | MintMeltQuote | MintSwap): void {
		this.highlightChange.emit(entity.id);
	}

	/**
	 * Reverts highlight to expanded row on mouse leave, or clears it
	 */
	public onRowLeave(): void {
		this.highlightChange.emit(this.more_entity?.id ?? null);
	}

	/**
	 * Handles the set quote state to paid action
	 * @param event - mouse event to stop propagation
	 * @param entity - quote entity to mark as paid
	 */
	public onSetQuoteStatePaid(event: MouseEvent, entity: MintMintQuote | MintMeltQuote): void {
		event.stopPropagation();
		event.preventDefault();
		this.setQuoteStatePaid.emit(entity);
	}
}
