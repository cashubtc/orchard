/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

/**
 * Stores minute-granularity samples scraped from the mint prometheus exporter.
 * Each row is one metric family + label set for one minute.
 * Counter and histogram values are stored cumulative as scraped; deltas are derived at query time.
 */
@Entity('metrics_mint')
@Index(['metric', 'labels', 'date'], {unique: true})
export class MintMetrics {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	// Metric family name (e.g. cdk_mint_operations_total)
	@Column({type: 'text'})
	metric: string;

	// Canonical label string (sorted key=value pairs, '' when unlabeled)
	@Column({type: 'text'})
	labels: string;

	// Metric type from MintMetricType enum
	@Column({type: 'text'})
	type: string;

	// Minute start timestamp (UTC)
	@Column({type: 'integer'})
	date: number;

	// Gauge/counter cumulative value (null for histograms)
	@Column({type: 'real', nullable: true})
	value: number | null;

	// Histogram cumulative sum of observations (null for gauges/counters)
	@Column({type: 'real', nullable: true})
	sum: number | null;

	// Histogram cumulative observation count (null for gauges/counters)
	@Column({type: 'integer', nullable: true})
	count: number | null;

	// Last time this record was updated (unix timestamp)
	@Column({type: 'integer'})
	updated_at: number;
}
