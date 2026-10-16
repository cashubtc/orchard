/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, computed, inject} from '@angular/core';
/* Vendor Dependencies */
import {MatDialog} from '@angular/material/dialog';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {PublicUrl} from '@client/modules/public/classes/public-url.class';
import {MintUri} from '@client/modules/mint/types/mint-uri.types';
import {getMintUri} from '@client/modules/mint/helpers/mint-uri.helpers';
/* Components */
import {NetworkConnectionComponent} from '@client/modules/network/components/network-connection/network-connection.component';

@Component({
	selector: 'orc-mint-general-info',
	standalone: false,
	templateUrl: './mint-general-info.component.html',
	styleUrl: './mint-general-info.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralInfoComponent {
	private dialog = inject(MatDialog);

	public loading = input.required<boolean>();
	public icon_data = input.required<string | null>();
	public info = input.required<MintInfo | null>();
	public error = input.required<boolean>();
	public device_type = input.required<DeviceType>();
	public connections = input<PublicUrl[]>([]);

	public connections_status_map = computed(() => {
		return new Map(
			this.connections()
				.filter((result) => result.url)
				.map((result) => [new URL(result.url!).origin, result.connection_status]),
		);
	});

	public state = computed(() => {
		if (this.error()) return 'offline';
		return 'online';
	});

	public status = computed(() => {
		if (this.error()) return 'inactive';
		return 'active';
	});

	public uris = computed(() => {
		const urls = this.info()?.urls ?? [];
		return urls.map((url) => getMintUri(url));
	});

	public onUriClick(uri: MintUri): void {
		this.dialog.open(NetworkConnectionComponent, {
			data: {
				uri: uri.uri,
				type: uri.type,
				label: uri.label,
				image: this.icon_data() ?? '/mint-icon-placeholder.png',
				name: this.info()?.name ?? '',
				section: 'mint',
				status: this.connections_status_map().get(uri.origin) ?? null,
				device_type: this.device_type(),
			},
		});
	}
}
