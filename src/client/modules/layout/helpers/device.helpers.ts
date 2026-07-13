/* Vendor Dependencies */
import {BreakpointState, Breakpoints} from '@angular/cdk/layout';
/* Native Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';

/** Maps a CDK breakpoint observer state to the app device type */
export function deviceTypeFromBreakpoints(state: BreakpointState): DeviceType {
	if (state.breakpoints[Breakpoints.XSmall]) return 'mobile';
	if (state.breakpoints[Breakpoints.Small] || state.breakpoints[Breakpoints.Medium]) return 'tablet';
	return 'desktop';
}
