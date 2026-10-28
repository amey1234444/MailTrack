import { api } from '@/lib/http';
import { requireUser, ownedAccount } from '@/lib/auth';
import { query } from '@/lib/db';
export const GET = api(async (req) => {
  const user = await requireUser(),
    p = new URL(req.url).searchParams;
  const account = await ownedAccount(user.id, p.get('accountId') || '');
  const page = Math.max(0, Math.min(100000, Number(p.get('page')) || 0));
  const q = (p.get('q') || '').slice(0, 200);
  const rows = await query(
    `SELECT gmail_id,thread_id,subject,sender,recipients,snippet,labels,received_at FROM mailbox_messages WHERE account_id=$1 AND (subject ILIKE $2 OR sender ILIKE $2 OR recipients ILIKE $2) ORDER BY received_at DESC LIMIT 26 OFFSET $3`,
    [account.id, `%${q}%`, page * 25],
  );
  const [count] = await query(
    'SELECT COUNT(*)::int AS total FROM mailbox_messages WHERE account_id=$1',
    [account.id],
  );
  return Response.json({
    messages: rows.slice(0, 25),
    hasMore: rows.length > 25,
    total: count.total,
  });
});
