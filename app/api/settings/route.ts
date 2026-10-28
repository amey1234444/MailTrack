import { z } from 'zod';
import { api, json } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { sameOrigin, HttpError } from '@/lib/security';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { revoke } from '@/lib/google';
import type { Account } from '@/lib/types';
export const PATCH = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  const { timezone } = z.object({ timezone: z.string().max(100) }).parse(await json(req));
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new HttpError(400, 'Invalid timezone');
  }
  await query('UPDATE users SET timezone=$1 WHERE id=$2', [timezone, user.id]);
  return Response.json({ ok: true });
});
export const DELETE = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  const data = await json(req);
  if (data.confirm !== user.email) throw new HttpError(400, 'Type your email to confirm deletion');
  const accounts = await query<Account>('SELECT * FROM accounts WHERE user_id=$1', [user.id]);
  for (const a of accounts) {
    await revoke(a);
    if (a.provider !== 'app_password')
      await query("UPDATE accounts SET status='reconnect' WHERE google_sub=$1", [a.google_sub]);
  }
  await query('DELETE FROM users WHERE id=$1', [user.id]);
  (await cookies()).delete('mt_session');
  return Response.json({ ok: true });
});
