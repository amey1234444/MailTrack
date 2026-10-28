import { api } from '@/lib/http';
import { sharedDocument } from '@/lib/documents';
import { recordEvent, noCache } from '@/lib/tracking';
export const GET = api(async (req) => {
  const url = new URL(req.url),
    token = url.pathname.split('/').at(-2)!;
  const doc = await sharedDocument(token, true);
  if (url.searchParams.has('download'))
    try {
      await recordEvent(doc.delivery_id, 'download', req, { documentId: doc.id });
    } catch {}
  return new Response(new Uint8Array(doc.data), {
    headers: {
      ...noCache,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    },
  });
});
