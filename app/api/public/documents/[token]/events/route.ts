import { z } from 'zod';
import { api, json } from '@/lib/http';
import { sharedDocument } from '@/lib/documents';
import { sameOrigin, HttpError } from '@/lib/security';
import { recordEvent } from '@/lib/tracking';
export const POST = api(async (req) => {
  sameOrigin(req);
  const t = new URL(req.url).pathname.split('/').at(-2)!;
  const doc = await sharedDocument(t);
  const data = z
    .object({
      kind: z.enum(['document_view', 'page_view']),
      page: z.number().int().min(1).optional(),
      duration: z.number().min(0).max(30).default(0),
      eventId: z.string().uuid(),
      sessionId: z.string().uuid(),
    })
    .parse(await json(req));
  if (data.kind === 'page_view' && (!data.page || data.page > doc.pages))
    throw new HttpError(400, 'Invalid PDF page');
  await recordEvent(
    doc.delivery_id,
    data.kind,
    req,
    { documentId: doc.id, page: data.page, duration: data.duration, sessionId: data.sessionId },
    `doc:${doc.share_id}:${data.eventId}`,
  );
  return Response.json({ ok: true });
});
