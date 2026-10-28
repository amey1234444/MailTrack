import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { sameOrigin } from '@/lib/security';
import { processMessage } from '@/lib/send';
export const maxDuration = 60;
export const POST = api(async (req) => {
  sameOrigin(req);
  return Response.json(
    await processMessage((await requireUser()).id, new URL(req.url).pathname.split('/').at(-2)!),
  );
});
