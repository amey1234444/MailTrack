import { query } from '@/lib/db';
import { recordEvent, noCache } from '@/lib/tracking';
import { safeDestination } from '@/lib/mail';
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const [link] = await query('SELECT * FROM links WHERE token=$1', [(await params).token]);
  if (!link || !safeDestination(link.destination))
    return new Response('This link is no longer available', { status: 404, headers: noCache });
  try {
    await recordEvent(link.delivery_id, 'click', req, { url: link.destination });
  } catch {
    /* Do not break a legitimate destination when analytics is unavailable. */
  }
  return new Response(null, { status: 302, headers: { ...noCache, Location: link.destination } });
}
export async function HEAD() {
  return new Response(null, { status: 200, headers: noCache });
}
