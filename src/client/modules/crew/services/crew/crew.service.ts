/* Core Dependencies */
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {BehaviorSubject, catchError, map, Observable, of, shareReplay, tap, throwError} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {ApiService} from '@client/modules/api/services/api/api.service';
/* Native Dependencies */
import {User} from '@client/modules/crew/classes/user.class';
import {Invite} from '@client/modules/crew/classes/invite.class';
import {
	CrewUserResponse,
	CrewUsersResponse,
	CrewUserNameUpdateResponse,
	CrewUserPasswordUpdateResponse,
	CrewUserTelegramUpdateResponse,
	CrewUserUpdateResponse,
	CrewUserDeleteResponse,
	CrewInvitesResponse,
	CrewInviteCreateResponse,
	CrewInviteUpdateResponse,
	CrewInviteDeleteResponse,
} from '@client/modules/crew/types/crew.types';
/* Local Dependencies */
import {
	USER_QUERY,
	USERS_QUERY,
	USER_NAME_UPDATE_MUTATION,
	USER_PASSWORD_UPDATE_MUTATION,
	USER_TELEGRAM_UPDATE_MUTATION,
	USER_UPDATE_MUTATION,
	USER_DELETE_MUTATION,
	INVITS_QUERY,
	INVITE_CREATE_MUTATION,
	INVITE_UPDATE_MUTATION,
	INVITE_DELETE_MUTATION,
} from './crew.queries';
/* Shared Dependencies */
import {UserRole} from '@shared/generated.types';

@Injectable({
	providedIn: 'root',
})
export class CrewService {
	public get user$(): Observable<User | null> {
		return this.user_subject.asObservable();
	}

	private readonly CACHE_KEYS = {
		USER: 'user',
		USERS: 'users',
		INVITES: 'invites',
	};
	private readonly CACHE_DURATIONS = {
		[this.CACHE_KEYS.USER]: 1 * 60 * 1000, // 1 minute
		[this.CACHE_KEYS.USERS]: 10 * 60 * 1000, // 10 minutes
		[this.CACHE_KEYS.INVITES]: 10 * 60 * 1000, // 10 minutes
	};

	/* Subjects for caching */
	private readonly user_subject!: BehaviorSubject<User | null>;
	private readonly users_subject!: BehaviorSubject<User[] | null>;
	private readonly invites_subject!: BehaviorSubject<Invite[] | null>;
	/* Observables for caching (rapid request caching) */
	private user_observable!: Observable<User> | null;

	constructor(
		private http: HttpClient,
		private cache: CacheService,
		private apiService: ApiService,
	) {
		this.user_subject = this.cache.createCache<User>(this.CACHE_KEYS.USER, this.CACHE_DURATIONS[this.CACHE_KEYS.USER]);
		this.users_subject = this.cache.createCache<User[]>(this.CACHE_KEYS.USERS, this.CACHE_DURATIONS[this.CACHE_KEYS.USERS]);
		this.invites_subject = this.cache.createCache<Invite[]>(this.CACHE_KEYS.INVITES, this.CACHE_DURATIONS[this.CACHE_KEYS.INVITES]);
	}

	public clearUserCache() {
		this.cache.clearCache(this.CACHE_KEYS.USER);
		this.cache.clearCache(this.CACHE_KEYS.USERS);
	}
	public clearInvitesCache() {
		this.cache.clearCache(this.CACHE_KEYS.INVITES);
	}

	public loadUser(): Observable<User> {
		if (this.user_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.USER)) return of(this.user_subject.value);
		if (this.user_observable) return this.user_observable;

		const query = getApiQuery(USER_QUERY);

		this.user_observable = this.http.post<OrchardRes<CrewUserResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.crew_user;
			}),
			map((user) => new User(user)),
			tap((user) => {
				this.cache.updateCache(this.CACHE_KEYS.USER, user);
				this.user_subject.next(user);
				this.user_observable = null;
			}),
			shareReplay(1),
			catchError((error) => {
				this.user_observable = null;
				this.user_subject.next(null);
				return throwError(() => error);
			}),
		);
		return this.user_observable;
	}

	/** Resolve administrator access from the same cached authenticated user everywhere. */
	public isAdmin(): Observable<boolean> {
		return this.loadUser().pipe(map((user) => user.role === UserRole.Admin));
	}

	public loadUsers(): Observable<User[]> {
		if (this.users_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.USERS)) return of(this.users_subject.value);

		const query = getApiQuery(USERS_QUERY);
		return this.http.post<OrchardRes<CrewUsersResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.crew_users;
			}),
			map((users) => users.map((user) => new User(user))),
			tap((users) => {
				this.cache.updateCache(this.CACHE_KEYS.USERS, users);
				this.users_subject.next(users);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	public loadInvites(): Observable<Invite[]> {
		if (this.invites_subject.value && this.cache.isCacheValid(this.CACHE_KEYS.INVITES)) return of(this.invites_subject.value);
		const query = getApiQuery(INVITS_QUERY);
		return this.http.post<OrchardRes<CrewInvitesResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.crew_invites;
			}),
			map((invites) => invites.map((invite) => new Invite(invite))),
			tap((invites) => {
				this.cache.updateCache(this.CACHE_KEYS.INVITES, invites);
				this.invites_subject.next(invites);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	public updateUserName(name: string): Observable<User> {
		const query = getApiQuery(USER_NAME_UPDATE_MUTATION, {name});
		return this.http.post<OrchardRes<CrewUserNameUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new User(response.data.crew_user_update_name);
			}),
			catchError((error) => {
				console.error('Error updating user name:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateUserPassword(password_old: string, password_new: string): Observable<User> {
		const query = getApiQuery(USER_PASSWORD_UPDATE_MUTATION, {password_old, password_new});
		return this.http.post<OrchardRes<CrewUserPasswordUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new User(response.data.crew_user_update_password);
			}),
			catchError((error) => {
				console.error('Error updating user password:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateUserTelegram(telegram_chat_id: string | null): Observable<User> {
		const query = getApiQuery(USER_TELEGRAM_UPDATE_MUTATION, {telegram_chat_id});
		return this.http.post<OrchardRes<CrewUserTelegramUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new User(response.data.crew_user_update_telegram);
			}),
			catchError((error) => {
				console.error('Error updating user telegram:', error);
				return throwError(() => error);
			}),
		);
	}

	public updateUser(
		id: string,
		label: string | null = null,
		role: UserRole | null = null,
		active: boolean | null = null,
	): Observable<User> {
		const query = getApiQuery(USER_UPDATE_MUTATION, {updateUser: {id, label, role, active}});
		return this.http.post<OrchardRes<CrewUserUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new User(response.data.crew_user_update);
			}),
			catchError((error) => {
				console.error('Error updating user:', error);
				return throwError(() => error);
			}),
		);
	}

	public deleteUser(id: string): Observable<boolean> {
		const query = getApiQuery(USER_DELETE_MUTATION, {id});
		return this.http.post<OrchardRes<CrewUserDeleteResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.crew_user_delete;
			}),
			catchError((error) => {
				console.error('Error deleting user:', error);
				return throwError(() => error);
			}),
		);
	}

	public createInvite(role: UserRole, label: string | null = null, expires_at: number | null = null): Observable<Invite> {
		const query = getApiQuery(INVITE_CREATE_MUTATION, {createInvite: {role, label, expires_at}});
		return this.http.post<OrchardRes<CrewInviteCreateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new Invite(response.data.crew_invite_create);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	public updateInvite(
		id: string,
		label: string | null = null,
		role: UserRole | null = null,
		expires_at: number | null = null,
	): Observable<Invite> {
		const query = getApiQuery(INVITE_UPDATE_MUTATION, {updateInvite: {id, label, role, expires_at}});
		return this.http.post<OrchardRes<CrewInviteUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return new Invite(response.data.crew_invite_update);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	public deleteInvite(id: string): Observable<boolean> {
		const query = getApiQuery(INVITE_DELETE_MUTATION, {id});
		return this.http.post<OrchardRes<CrewInviteDeleteResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.crew_invite_delete;
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}
}
