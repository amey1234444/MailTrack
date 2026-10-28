import { z } from 'zod';
import { api, json } from '@/lib/http';
import { requireUser, ownedAccount } from '@/lib/auth';
import { sameOrigin, rateLimit } from '@/lib/security';
import { syncMailbox } from '@/lib/sync';
export const maxDuration = 60;
export const POST = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  const { accountId } = z.object({ accountId: z.string() }).parse(await json(req));
  await rateLimit(`sync:${user.id}`, 300, 3600);
  return Response.json(await syncMailbox(await ownedAccount(user.id, accountId)));
});
