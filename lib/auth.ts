import { cookies } from 'next/headers';
import { query } from './db';
import { hash, HttpError, token, cookieOptions } from './security';
import type { User, Account } from './types';
export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get('mt_session')?.value;
  if (!value) return null;
  const [u] = await query<User>(
    'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hash(value)],
  );
  return u || null;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'Please sign in with Google');
  return u;
}
export async function createSession(userId: string) {
  const value = token();
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hash(value), userId],
  );
  (await cookies()).set('mt_session', value, { ...cookieOptions, maxAge: 7 * 86400 });
}
export async function ownedAccount(userId: string, accountId: string) {
  const [a] = await query<Account>('SELECT * FROM accounts WHERE id=$1 AND user_id=$2', [
    accountId,
    userId,
  ]);
  if (!a) throw new HttpError(404, 'Mailbox not found');
  return a;
}
