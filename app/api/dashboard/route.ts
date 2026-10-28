import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
export const GET = api(async (req) => {
  const user = await requireUser();
  const p = new URL(req.url).searchParams;
  const search = (p.get('q') || '').slice(0, 200);
  const page = Math.max(0, Math.min(10000, Number(p.get('page')) || 0));
  const messages = await query(
    `SELECT m.id,m.subject,m.created_at,a.email AS sender, COUNT(DISTINCT d.id)::int AS recipients,COUNT(DISTINCT d.id) FILTER(WHERE d.status='sent')::int AS sent,COUNT(DISTINCT d.id) FILTER(WHERE d.status IN('failed','uncertain','pending','sending'))::int AS issues,COUNT(DISTINCT e.id) FILTER(WHERE e.kind='open')::int AS opens,COUNT(DISTINCT e.id) FILTER(WHERE e.kind='click')::int AS clicks,COUNT(DISTINCT d.id) FILTER(WHERE d.replied_at IS NOT NULL)::int AS replies,MAX(e.occurred_at) AS last_activity,COUNT(DISTINCT e.id) FILTER(WHERE e.kind='open' AND e.occurred_at>now()-interval '10 minutes')::int AS recent_opens FROM messages m JOIN accounts a ON a.id=m.account_id LEFT JOIN deliveries d ON d.message_id=m.id LEFT JOIN events e ON e.delivery_id=d.id WHERE m.user_id=$1 AND (m.subject ILIKE $2 OR EXISTS(SELECT 1 FROM deliveries d2 WHERE d2.message_id=m.id AND d2.recipient ILIKE $2)) GROUP BY m.id,a.email ORDER BY m.created_at DESC LIMIT 21 OFFSET $3`,
    [user.id, `%${search}%`, page * 20],
  );
  const [stats] = await query(
    `SELECT (SELECT COUNT(*)::int FROM deliveries d JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1 AND d.status='sent') AS sent,COUNT(*) FILTER(WHERE e.kind='open')::int AS opens,COUNT(*) FILTER(WHERE e.kind='click')::int AS clicks,COUNT(DISTINCT e.delivery_id) FILTER(WHERE e.kind='reply')::int AS replies,COUNT(*) FILTER(WHERE e.kind='document_view')::int AS document_views FROM events e JOIN deliveries d ON d.id=e.delivery_id JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1`,
    [user.id],
  );
  const activity = await query(
    `SELECT e.id,e.kind,e.occurred_at,e.automated,d.recipient,m.subject,m.id AS message_id FROM events e JOIN deliveries d ON d.id=e.delivery_id JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1 ORDER BY e.occurred_at DESC LIMIT 15`,
    [user.id],
  );
  const chart = await query(
    `SELECT to_char(e.occurred_at AT TIME ZONE $2,'YYYY-MM-DD') AS day,COUNT(*) FILTER(WHERE kind='open')::int AS opens,COUNT(*) FILTER(WHERE kind='click')::int AS clicks FROM events e JOIN deliveries d ON d.id=e.delivery_id JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1 AND e.occurred_at>now()-interval '7 days' GROUP BY day ORDER BY day`,
    [user.id, user.timezone],
  );
  return Response.json({
    messages: messages.slice(0, 20),
    hasMore: messages.length > 20,
    stats,
    activity,
    chart,
  });
});
