import { api } from '@/lib/http';
import { equal, HttpError } from '@/lib/security';
import { query } from '@/lib/db';
import { syncMailbox } from '@/lib/sync';
import type { Account } from '@/lib/types';
export const maxDuration = 60;
export const GET = api(async (req) => {
  if (
    !process.env.CRON_SECRET ||
    !equal(req.headers.get('authorization') || '', `Bearer ${process.env.CRON_SECRET}`)
  )
    throw new HttpError(401, 'Unauthorized');
  const accounts = await query<Account>(
    "SELECT * FROM accounts WHERE status='connected' ORDER BY synced_at ASC NULLS FIRST LIMIT 3",
  );
  const results = [];
  const start = Date.now();
  for (const a of accounts) {
    if (Date.now() - start > 40000) break;
    try {
      results.push({ id: a.id, ...(await syncMailbox(a)) });
    } catch {
      results.push({ id: a.id, error: 'Sync failed; reconnect or retry' });
    }
  }
  await query('DELETE FROM sessions WHERE expires_at<now()');
  await query('DELETE FROM rate_limits WHERE reset_at<now()');
  await query('DELETE FROM invitations WHERE expires_at<now()');
  return Response.json({ results });
});
