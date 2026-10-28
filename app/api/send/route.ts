import { api, json } from '@/lib/http';
import { sameOrigin } from '@/lib/security';
import { requireUser } from '@/lib/auth';
import { sendMessage } from '@/lib/send';
export const maxDuration = 60;
export const POST = api(async (req) => {
  sameOrigin(req);
  return Response.json(await sendMessage((await requireUser()).id, await json(req)));
});
