import { query } from '@/lib/db';
import { recordEvent, noCache } from '@/lib/tracking';
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const value = (await params).token.replace(/\.gif$/, '');
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
    try {
      const [d] = await query('SELECT id FROM deliveries WHERE token=$1', [value]);
      if (d) await recordEvent(d.id, 'open', req);
    } catch {
      /* Pixel response remains valid if recording fails. */
    }
  }
  return new Response(gif, { headers: { ...noCache, 'Content-Type': 'image/gif' } });
}
export async function HEAD() {
  return new Response(null, { headers: { ...noCache, 'Content-Type': 'image/gif' } });
}
