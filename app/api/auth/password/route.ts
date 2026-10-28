import { z } from 'zod';
import { api, json } from '@/lib/http';
import { query } from '@/lib/db';
import { createSession, currentUser } from '@/lib/auth';
import { sameOrigin, rateLimit, hash, id, seal, HttpError } from '@/lib/security';
import { verifyMailbox } from '@/lib/mailbox';
export const maxDuration = 60;
export const POST = api(async (req) => {
  sameOrigin(req);
  const input = z
    .object({
      email: z
        .string()
        .email()
        .max(254)
        .transform((v) => v.trim().toLowerCase()),
      password: z
        .string()
        .max(100)
        .transform((v) => v.replace(/\s/g, ''))
        .pipe(
          z
            .string()
            .regex(
              /^[a-z]{16}$/,
              'Enter a 16-letter Google App Password, not your regular password',
            ),
        ),
      invite: z.string().max(200).optional(),
      consent: z.literal(true),
    })
    .parse(await json(req));
  await rateLimit(
    `login-ip:${hash(req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown')}`,
    20,
    900,
  );
  await rateLimit(`login-email:${hash(input.email)}`, 10, 900);
  let invitation;
  if (input.invite) {
    [invitation] = await query(
      'SELECT * FROM invitations WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()',
      [hash(input.invite)],
    );
    if (!invitation || invitation.email !== input.email)
      throw new HttpError(403, 'Use the exact invited email address and a valid approval link');
  }
  const existing = input.invite ? null : await currentUser();
  if (!invitation && !existing) {
    const allowed = (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(input.email))
      throw new HttpError(403, 'This address is not allowed to sign in to this deployment');
  }
  await verifyMailbox(input.email, input.password);
  let userId = invitation?.user_id || existing?.id;
  // Separate identity namespace prevents an App Password login from claiming an OAuth workspace.
  const identity = `app-password:${input.email}`;
  if (!userId) {
    const [user] = await query(
      'INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$3) ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email RETURNING id',
      [id(), identity, input.email],
    );
    userId = user.id;
  }
  const values = [id(), userId, identity, input.email, seal(input.password)];
  const suffix = `ON CONFLICT(user_id,google_sub) DO UPDATE SET refresh_token=EXCLUDED.refresh_token,status='connected',provider='app_password' RETURNING id`;
  if (invitation) {
    const saved = await query(
      `WITH approved AS (UPDATE invitations SET used_at=now() WHERE id=$6 AND used_at IS NULL AND expires_at>now() RETURNING id) INSERT INTO accounts(id,user_id,google_sub,email,access_token,refresh_token,expires_at,provider) SELECT $1,$2,$3,$4,'',$5,now(),'app_password' FROM approved ${suffix}`,
      [...values, invitation.id],
    );
    if (!saved.length) throw new HttpError(400, 'Approval link already used or expired');
    return Response.json({ redirect: '/approved' });
  }
  await query(
    `INSERT INTO accounts(id,user_id,google_sub,email,access_token,refresh_token,expires_at,provider) VALUES($1,$2,$3,$4,'',$5,now(),'app_password') ${suffix}`,
    values,
  );
  await createSession(userId);
  return Response.json({ redirect: '/workspace?connected=1' });
});
