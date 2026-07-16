/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Native Dependencies */
import {SystemInfo} from '@client/modules/index/classes/system-info.class';
import {formatBytesSize} from '@client/modules/index/helpers/system-info.helpers';
import {SystemInfoTile} from '@client/modules/index/types/system.types';

@Component({
	selector: 'orc-index-system-info',
	standalone: false,
	templateUrl: './index-system-info.component.html',
	styleUrl: './index-system-info.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSystemInfoComponent {
	public readonly info = input.required<SystemInfo | null>();
	public readonly loading = input.required<boolean>();

	public readonly tiles = computed<SystemInfoTile[]>(() => this.getTiles());

	/* *******************************************************
		Tiles
	******************************************************** */

	/** Builds the host fact tiles from the loaded system info */
	private getTiles(): SystemInfoTile[] {
		const info = this.info();
		if (!info) return [];
		return [
			{value: `${info.os_platform} ${info.os_release}`, caption: `${info.arch} · operating system`},
			{value: `${info.cpu_cores} ${info.cpu_cores === 1 ? 'core' : 'cores'}`, caption: info.cpu_model},
			{value: formatBytesSize(info.memory_total_bytes), caption: 'total memory'},
			{value: formatBytesSize(info.disk_total_bytes), caption: 'total disk'},
			{value: info.node_version, caption: `node version`},
		];
	}
}
