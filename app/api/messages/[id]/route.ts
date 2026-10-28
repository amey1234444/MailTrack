import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { HttpError } from '@/lib/security';
export const GET = api(async (req) => {
  const user = await requireUser();
  const id = new URL(req.url).pathname.split('/').pop();
  const [m] = await query(
    'SELECT m.*,a.email AS sender FROM messages m JOIN accounts a ON a.id=m.account_id WHERE m.id=$1 AND m.user_id=$2',
    [id, user.id],
  );
  if (!m) throw new HttpError(404, 'Message not found');
  const deliveries = await query(
    `SELECT d.id,d.recipient,d.recipient_type,d.status,d.error,d.sent_at,d.replied_at,COUNT(e.id) FILTER(WHERE e.kind='open')::int AS opens,COUNT(e.id) FILTER(WHERE e.kind='click')::int AS clicks,MIN(e.occurred_at) FILTER(WHERE e.kind='open') AS first_open FROM deliveries d LEFT JOIN events e ON e.delivery_id=d.id WHERE d.message_id=$1 GROUP BY d.id ORDER BY d.recipient`,
    [id],
  );
  const events = await query(
    `SELECT e.*,d.recipient FROM events e JOIN deliveries d ON d.id=e.delivery_id WHERE d.message_id=$1 ORDER BY e.occurred_at DESC LIMIT 500`,
    [id],
  );
  return Response.json({ message: m, deliveries, events, eventLimit: 500 });
});
