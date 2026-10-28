import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { hash, sameOrigin } from '@/lib/security';
import { api } from '@/lib/http';
export const POST = api(async (req) => {
  sameOrigin(req);
  const jar = await cookies(),
    value = jar.get('mt_session')?.value;
  if (value) await query('DELETE FROM sessions WHERE token_hash=$1', [hash(value)]);
  jar.delete('mt_session');
  return Response.json({ ok: true });
});
