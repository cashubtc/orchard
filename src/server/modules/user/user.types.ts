/* Local Dependencies */
import type {User} from './user.entity.js';

/**
 * A user whose password was just checked, with the hash it was checked against.
 * A session starts only while that hash is still the stored one.
 */
export type VerifiedUser = Pick<User, 'id' | 'password_hash'>;
