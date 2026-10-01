import {OrchardCrewUser, UserRole} from '@shared/generated.types';

export class User implements OrchardCrewUser {
	id: string;
	name: string;
	role: UserRole;
	label: string | null;
	active: boolean;
	telegram_chat_id: string | null;
	created_at: number;

	/** Whether the user has full administrative access */
	public get is_admin(): boolean {
		return this.role === UserRole.Admin;
	}

	constructor(ou: OrchardCrewUser) {
		this.id = ou.id;
		this.name = ou.name;
		this.role = ou.role;
		this.label = ou.label ?? null;
		this.active = ou.active;
		this.telegram_chat_id = ou.telegram_chat_id ?? null;
		this.created_at = ou.created_at;
	}
}
