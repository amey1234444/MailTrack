import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
export const GET = api(async () => {
  const user = await requireUser();
  return Response.json(
    await query(
      'SELECT id,email,status,synced_at,sync_complete,created_at FROM accounts WHERE user_id=$1 ORDER BY created_at',
      [user.id],
    ),
  );
});
