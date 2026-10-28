import { query } from './db';
import { id, rateLimit } from './security';
import { looksAutomated } from './mail';
export async function recordEvent(
  deliveryId: string,
  kind: string,
  req: Request,
  detail: Record<string, unknown> = {},
  dedupe?: string,
) {
  await rateLimit(`event:${deliveryId}`, 600, 3600);
  // User agent is only inspected for a heuristic flag; never stored, and no IP geolocation is collected.
  await query(
    'INSERT INTO events(id,delivery_id,kind,automated,detail,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedupe_key) DO NOTHING',
    [
      id(),
      deliveryId,
      kind,
      looksAutomated(req.headers.get('user-agent') || ''),
      JSON.stringify(detail),
      dedupe || null,
    ],
  );
}
export const noCache = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Robots-Tag': 'noindex, nofollow',
};
