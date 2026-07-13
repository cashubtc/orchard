/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

/**
 * Stores minute-granularity system health metrics.
 * Each row represents one metric type for one minute.
 *
 * Metrics tracked:
 * - cpu_percent: CPU utilization percentage (0-100)
 * - memory_percent: System memory usage percentage (0-100)
 * - memory_rss_mb: Process resident set size in MB
 * - disk_percent: Root disk usage percentage (0-100)
 * - load_avg_1m/5m/15m: System load averages
 * - heap_used_mb/heap_total_mb: Node.js heap in MB
 * - uptime_system/uptime_process: Uptime in seconds
 */
@Entity('metrics_system')
@Index(['metric', 'date'], {unique: true})
export class SystemMetrics {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	// Metric type from SystemMetric enum
	@Column({type: 'text'})
	metric: string;

	// Minute start timestamp (UTC)
	@Column({type: 'integer'})
	date: number;

	// The metric value as a float
	@Column({type: 'real'})
	value: number;

	// Last time this record was updated (unix timestamp)
	@Column({type: 'integer'})
	updated_at: number;
}
