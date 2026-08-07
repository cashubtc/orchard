/* Local Dependencies */
import {UTXOracleProgress} from './utxoracle.types.js';

/**
 * Helper class to manage and emit progress updates during oracle computation
 */
export class UTXOracleProgressTracker {
	private callback?: (progress: UTXOracleProgress) => void;

	// Define relative weights for each stage
	private readonly STAGE_WEIGHTS = {
		connecting: 1,
		finding_start: 1,
		finding_end: 1,
		loading_transactions: 47,
		computing_prices: 50,
	};

	private readonly total_weight: number;

	constructor(callback?: (progress: UTXOracleProgress) => void) {
		this.callback = callback;
		this.total_weight = Object.values(this.STAGE_WEIGHTS).reduce((sum, w) => sum + w, 0);
	}

	/**
	 * Emit progress for a stage
	 */
	public emit(stage: keyof typeof this.STAGE_WEIGHTS, stage_progress: number, message?: string): void {
		if (!this.callback) return;

		// Calculate cumulative progress up to this stage
		const stages_before = Object.keys(this.STAGE_WEIGHTS).indexOf(stage);
		const weight_before = Object.values(this.STAGE_WEIGHTS)
			.slice(0, stages_before)
			.reduce((sum, w) => sum + w, 0);

		// Add current stage progress
		const current_weight = this.STAGE_WEIGHTS[stage] * (stage_progress / 100);
		const date_progress = ((weight_before + current_weight) / this.total_weight) * 100;

		this.callback({
			date_progress: Math.min(100, Math.max(0, date_progress)),
			message,
		});
	}

	/**
	 * Create a connection phase tracker that increments through RPC calls
	 */
	public createConnectionTracker(): () => void {
		const steps = [
			{progress: 0, message: 'Connecting to node...'},
			{progress: 20, message: 'Validating RPC credentials...'},
			{progress: 40, message: 'Getting block count...'},
			{progress: 60, message: 'Getting consensus tip hash...'},
			{progress: 80, message: 'Getting block header...'},
			{progress: 100, message: 'Connected to node'},
		];

		let current_step = 0;

		return () => {
			if (current_step < steps.length) {
				const step = steps[current_step];
				this.emit('connecting', step.progress, step.message);
				current_step++;
			}
		};
	}

	/**
	 * Create a sub-tracker for iterating through blocks with automatic progress
	 */
	public createBlockIterator(
		stage: keyof typeof this.STAGE_WEIGHTS,
		start_block: number,
		end_block: number,
		message_template: string,
		progress_offset: number = 0, // within stage, 0-100
		progress_range: number = 100, // how much of stage this takes up
	): (current_block: number) => void {
		const total_blocks = end_block - start_block + 1;
		return (current_block: number) => {
			const blocks_processed = current_block - start_block + 1;
			const iterator_progress = (blocks_processed / total_blocks) * 100;
			const stage_progress = progress_offset + (iterator_progress / 100) * progress_range;
			const message = message_template
				.replace('{height}', current_block.toString())
				.replace('{current}', blocks_processed.toString())
				.replace('{total}', total_blocks.toString());
			this.emit(stage, stage_progress, message);
		};
	}

	/**
	 * Create a sub-tracker for binary search with automatic progress
	 */
	public createSearchIterator(stage: keyof typeof this.STAGE_WEIGHTS, max_iterations: number, message: string): () => void {
		let call_count = 0;
		return () => {
			call_count++;
			const stage_progress = Math.min(100, (call_count / max_iterations) * 100);
			this.emit(stage, stage_progress, message);
		};
	}
}
