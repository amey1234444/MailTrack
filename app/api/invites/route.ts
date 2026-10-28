import { z } from 'zod';
import { api, json } from '@/lib/http';
import { requireUser, ownedAccount } from '@/lib/auth';
import { sameOrigin, id, token, hash, origin, rateLimit } from '@/lib/security';
import { query } from '@/lib/db';
import { gmail } from '@/lib/google';
import { mime, email, escapeHtml } from '@/lib/mail';
export const POST = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  const input = z.object({ email, accountId: z.string() }).parse(await json(req));
  const account = await ownedAccount(user.id, input.accountId);
  await rateLimit(`invites:${user.id}`, 10, 3600);
  const value = token(),
    inviteId = id();
  await query(
    "INSERT INTO invitations(id,user_id,email,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '24 hours')",
    [inviteId, user.id, input.email, hash(value)],
  );
  const url = `${origin()}/approve/${value}`;
  const text = `${user.email} is requesting access to your Gmail mailbox in MailTrack. Approval allows them to sync your email metadata, view message content on demand, send email, and view tracking analytics for tracked messages. Only approve if you trust this person. Review and approve: ${url}\nThis link expires in 24 hours. If you did not expect this request, ignore it.`;
  try {
    await gmail(account, 'messages/send', {
      method: 'POST',
      body: JSON.stringify({
        raw: mime({
          from: account.email,
          to: input.email,
          subject: 'Review a MailTrack mailbox access request',
          text,
          html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
          messageId: `${id()}@${new URL(origin()).hostname}`,
        }),
      }),
    });
  } catch (e) {
    await query('DELETE FROM invitations WHERE id=$1', [inviteId]);
    throw e;
  }
  return Response.json({ ok: true });
});
export const GET = api(async () => {
  const user = await requireUser();
  return Response.json(
    await query(
      'SELECT id,email,expires_at,used_at,created_at FROM invitations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [user.id],
    ),
  );
});
export const DELETE = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  const { id: inviteId } = z.object({ id: z.string() }).parse(await json(req));
  await query('DELETE FROM invitations WHERE id=$1 AND user_id=$2', [inviteId, user.id]);
  return Response.json({ ok: true });
});
