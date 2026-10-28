import { smtpSend, imapMessage } from './mailbox';
import { query } from './db';
import { seal, unseal, origin, HttpError } from './security';
import type { Account } from './types';
export const scopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];
export async function exchange(code: string, verifier: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin()}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new HttpError(400, 'Google authorization expired. Please connect again.');
  return r.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}
export async function accessToken(account: Account) {
  if (account.status !== 'connected')
    throw new HttpError(409, 'Reconnect this mailbox to continue');
  if (new Date(account.expires_at).getTime() > Date.now() + 60000)
    return unseal(account.access_token);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: unseal(account.refresh_token),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    if (r.status === 400)
      await query("UPDATE accounts SET status='reconnect' WHERE id=$1", [account.id]);
    throw new HttpError(409, 'Google access could not be refreshed. Reconnect this mailbox.');
  }
  const t = await r.json();
  await query('UPDATE accounts SET access_token=$1,expires_at=$2 WHERE id=$3', [
    seal(t.access_token),
    new Date(Date.now() + t.expires_in * 1000),
    account.id,
  ]);
  account.access_token = seal(t.access_token);
  account.expires_at = new Date(Date.now() + t.expires_in * 1000);
  return t.access_token as string;
}
export async function gmail<T>(account: Account, path: string, init: RequestInit = {}): Promise<T> {
  if (account.provider === 'app_password') {
    if (account.status !== 'connected') throw new HttpError(409, 'Reconnect this mailbox');
    if (path === 'messages/send')
      return (await smtpSend(account, JSON.parse(String(init.body)).raw)) as T;
    if (path.startsWith('messages/'))
      return (await imapMessage(account, decodeURIComponent(path.slice(9).split('?')[0]))) as T;
    throw new HttpError(400, 'Unsupported mailbox operation');
  }
  const access = await accessToken(account);
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) {
    await query("UPDATE accounts SET status='reconnect' WHERE id=$1", [account.id]);
    throw new HttpError(409, 'Google access was revoked or expired. Reconnect this mailbox.');
  }
  if (!r.ok)
    throw new HttpError(
      r.status === 404 ? 404 : 502,
      r.status === 404
        ? 'Gmail resource no longer exists'
        : `Gmail request failed (${r.status}). Check mailbox permissions and sending limits.`,
    );
  return r.json();
}
export async function revoke(account: Account) {
  if (account.provider === 'app_password') return;
  const r = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: unseal(account.refresh_token) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok && r.status !== 400)
    throw new HttpError(502, 'Google could not revoke access. Please try again.');
}
