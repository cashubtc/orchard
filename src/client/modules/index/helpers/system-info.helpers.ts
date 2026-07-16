/** Formats a byte count into a compact GB/TB label (e.g. "16 GB", "1.5 TB") */
export function formatBytesSize(bytes: number | null | undefined): string {
	if (!bytes || bytes <= 0) return '—';
	const gb = bytes / 1024 ** 3;
	const value = gb >= 1000 ? gb / 1024 : gb;
	const unit = gb >= 1000 ? 'TB' : 'GB';
	const rounded = Math.round(value * 10) / 10;
	const label = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
	return `${label} ${unit}`;
}
