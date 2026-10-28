import { cookies } from 'next/headers';
import { api } from '@/lib/http';
import { configured, token, hash, seal, origin, cookieOptions, HttpError } from '@/lib/security';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { scopes } from '@/lib/google';
export const GET = api(async (req) => {
  if (!configured()) return Response.redirect(`${origin()}/?setup=1`);
  const invite = new URL(req.url).searchParams.get('invite');
  let expectedEmail = '';
  let inviteId = '';
  if (invite) {
    const [i] = await query(
      'SELECT * FROM invitations WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL',
      [hash(invite)],
    );
    if (!i) throw new HttpError(400, 'This approval link has expired or has already been used');
    expectedEmail = i.email;
    inviteId = i.id;
  }
  const user = invite ? null : await currentUser();
  const nonce = token(),
    verifier = token();
  const state = seal(
    JSON.stringify({
      nonce,
      verifier,
      uid: user?.id,
      inviteId,
      expectedEmail,
      exp: Date.now() + 600000,
    }),
  );
  (await cookies()).set('mt_oauth', nonce, { ...cookieOptions, maxAge: 600 });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin()}/api/auth/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: Buffer.from(hash(verifier), 'hex').toString('base64url'),
    code_challenge_method: 'S256',
    ...(expectedEmail ? { login_hint: expectedEmail } : {}),
  }).toString();
  return Response.redirect(url);
});
