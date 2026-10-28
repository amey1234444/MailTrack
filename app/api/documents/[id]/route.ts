import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { sameOrigin, HttpError } from '@/lib/security';
import { query } from '@/lib/db';
export const DELETE = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser(),
    id = new URL(req.url).pathname.split('/').pop();
  const deleted = await query('DELETE FROM documents WHERE id=$1 AND user_id=$2 RETURNING id', [
    id,
    user.id,
  ]);
  if (!deleted.length) throw new HttpError(404, 'Document not found');
  return Response.json({ ok: true });
});
export const GET = api(async (req) => {
  const user = await requireUser(),
    id = new URL(req.url).pathname.split('/').pop();
  const [document] = await query('SELECT id,name,pages FROM documents WHERE id=$1 AND user_id=$2', [
    id,
    user.id,
  ]);
  if (!document) throw new HttpError(404, 'Document not found');
  const recipients = await query(
    `SELECT d.recipient,COUNT(e.id) FILTER(WHERE e.kind='document_view')::int AS views,COUNT(e.id) FILTER(WHERE e.kind='download')::int AS downloads,COALESCE(SUM((e.detail->>'duration')::numeric) FILTER(WHERE e.kind='page_view'),0)::int AS seconds,MAX(e.occurred_at) AS last_activity FROM document_shares s JOIN deliveries d ON d.id=s.delivery_id LEFT JOIN events e ON e.delivery_id=d.id AND e.detail->>'documentId'=$1 WHERE s.document_id=$1 GROUP BY d.recipient ORDER BY last_activity DESC NULLS LAST`,
    [id],
  );
  const pages = await query(
    `SELECT (e.detail->>'page')::int AS page,COUNT(DISTINCT e.detail->>'sessionId')::int AS sessions,COALESCE(SUM((e.detail->>'duration')::numeric),0)::int AS seconds FROM events e JOIN deliveries d ON d.id=e.delivery_id JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1 AND e.detail->>'documentId'=$2 AND e.kind='page_view' GROUP BY page ORDER BY page`,
    [user.id, id],
  );
  return Response.json({ document, recipients, pages });
});
