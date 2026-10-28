import { api } from '@/lib/http';
import { requireUser, ownedAccount } from '@/lib/auth';
import { gmail } from '@/lib/google';
import type { GmailMessage } from '@/lib/types';
export const GET = api(async (req) => {
  const user = await requireUser(),
    url = new URL(req.url);
  const account = await ownedAccount(user.id, url.searchParams.get('accountId') || '');
  const m = await gmail<GmailMessage>(
    account,
    `messages/${encodeURIComponent(url.pathname.split('/').pop()!)}?format=full`,
  );
  const textParts: string[] = [];
  function walk(p: GmailMessage['payload']) {
    if (p?.mimeType === 'text/plain' && p.body?.data)
      textParts.push(Buffer.from(p.body.data, 'base64url').toString());
    for (const child of p?.parts || []) walk(child);
  }
  walk(m.payload);
  return Response.json({
    headers: m.payload?.headers || [],
    text:
      textParts.join('\n\n') ||
      m.snippet ||
      'No plain-text content is available. Open the original message in Gmail.',
    gmailId: m.id,
  });
});
