/* Core Dependencies */
import {Injectable} from '@angular/core';
/* Native Dependencies */
import {NavSecondaryItem} from '@client/modules/nav/types/nav-secondary-item.type';

@Injectable({
	providedIn: 'root',
})
export class NavService {
	private menuItems: Record<string, NavSecondaryItem[]> = {
		index: [
			{
				name: 'Home',
				navroute: '',
				subsection: 'home',
			},
			{
				name: 'Crew',
				navroute: 'crew',
				subsection: 'crew',
			},
			{
				name: 'System',
				navroute: 'system',
				subsection: 'system',
			},
		],
		bitcoin: [
			{
				name: 'Dashboard',
				navroute: 'bitcoin',
				subsection: 'dashboard',
			},
		],
		lightning: [
			{
				name: 'Dashboard',
				navroute: 'lightning',
				subsection: 'dashboard',
			},
		],
		mint: [
			{
				name: 'Dashboard',
				navroute: 'mint',
				subsection: 'dashboard',
			},
			{
				name: 'Info',
				navroute: 'mint/info',
				subsection: 'info',
			},
			{
				name: 'Config',
				navroute: 'mint/config',
				subsection: 'config',
			},
			{
				name: 'Keysets',
				navroute: 'mint/keysets',
				subsection: 'keysets',
			},
			{
				name: 'Database',
				navroute: 'mint/database',
				subsection: 'database',
			},
		],
		ecash: [
			{
				name: 'Dashboard',
				navroute: 'ecash',
				subsection: 'dashboard',
			},
		],
		settings: [
			{
				name: 'Device',
				navroute: 'settings/device',
				subsection: 'device',
			},
			{
				name: 'User',
				navroute: 'settings/user',
				subsection: 'user',
			},
			{
				name: 'App',
				navroute: 'settings/app',
				subsection: 'app',
			},
		],
	};

	public getMenuItems(section: string): NavSecondaryItem[] {
		return structuredClone(this.menuItems[section]);
	}
}
