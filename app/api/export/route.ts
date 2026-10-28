import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { csvCell } from '@/lib/mail';
export const GET = api(async () => {
  const user = await requireUser();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            '\uFEFF' +
              [
                'Subject',
                'Recipient',
                'Event',
                'Timestamp UTC',
                'Automated/proxy heuristic',
                'Details',
              ]
                .map(csvCell)
                .join(',') +
              '\r\n',
          ),
        );
        let last = '';
        for (;;) {
          const rows = await query(
            `SELECT e.id,m.subject,d.recipient,e.kind,e.occurred_at,e.automated,e.detail FROM events e JOIN deliveries d ON d.id=e.delivery_id JOIN messages m ON m.id=d.message_id WHERE m.user_id=$1 AND e.id>$2 ORDER BY e.id LIMIT 500`,
            [user.id, last],
          );
          if (!rows.length) break;
          for (const r of rows)
            controller.enqueue(
              encoder.encode(
                [
                  r.subject,
                  r.recipient,
                  r.kind,
                  new Date(r.occurred_at).toISOString(),
                  r.automated,
                  JSON.stringify(r.detail),
                ]
                  .map(csvCell)
                  .join(',') + '\r\n',
              ),
            );
          last = rows.at(-1)!.id;
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mailtrack-activity.csv"',
      'Cache-Control': 'no-store',
    },
  });
});
