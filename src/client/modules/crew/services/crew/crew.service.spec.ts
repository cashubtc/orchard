import {TestBed} from '@angular/core/testing';
import {firstValueFrom, of, throwError} from 'rxjs';
import {User} from '@client/modules/crew/classes/user.class';
import {UserRole} from '@shared/generated.types';
import {CrewService} from './crew.service';

describe('CrewService administrator access', () => {
	it('derives access from the authenticated user and propagates a failed user read', async () => {
		const service = TestBed.inject(CrewService);
		const user = new User({id: '1', name: 'Operator', role: UserRole.Admin, active: true, created_at: 0});
		const load = spyOn(service, 'loadUser').and.returnValue(of(user));
		expect(await firstValueFrom(service.isAdmin())).toBeTrue();
		load.and.returnValue(of({...user, role: UserRole.Reader}));
		expect(await firstValueFrom(service.isAdmin())).toBeFalse();
		load.and.returnValue(throwError(() => new Error('Authentication failed')));
		await expectAsync(firstValueFrom(service.isAdmin())).toBeRejectedWithError('Authentication failed');
	});
});
