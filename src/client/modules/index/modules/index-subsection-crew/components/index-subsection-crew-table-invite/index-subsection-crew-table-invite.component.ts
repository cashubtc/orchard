/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, signal, computed, output} from '@angular/core';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {Invite} from '@client/modules/crew/classes/invite.class';

@Component({
	selector: 'orc-index-subsection-crew-table-invite',
	standalone: false,
	templateUrl: './index-subsection-crew-table-invite.component.html',
	styleUrl: './index-subsection-crew-table-invite.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSubsectionCrewTableInviteComponent {
	public invite = input.required<Invite>();
	public device_desktop = input.required<boolean>();

	public editInvite = output<Invite>();
	public deleteInvite = output<Invite>();

	public now = signal(DateTime.now().toUnixInteger());

	public invite_url = computed(() => {
		return `${window.location.origin}/auth/signup/${this.invite().token}`;
	});
}
