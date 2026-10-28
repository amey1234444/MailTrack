import { api } from '@/lib/http';
import { requireUser, ownedAccount } from '@/lib/auth';
import { sameOrigin } from '@/lib/security';
import { query } from '@/lib/db';
import { revoke } from '@/lib/google';
export const DELETE = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser(),
    account = await ownedAccount(user.id, new URL(req.url).pathname.split('/').pop()!);
  await revoke(account);
  if (account.provider !== 'app_password')
    await query("UPDATE accounts SET status='reconnect' WHERE google_sub=$1", [account.google_sub]);
  await query('DELETE FROM accounts WHERE id=$1', [account.id]);
  return Response.json({ ok: true });
});
