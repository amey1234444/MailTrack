import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { createSession, currentUser } from '@/lib/auth';
import { exchange, scopes } from '@/lib/google';
import { id, unseal, seal, equal, origin, HttpError } from '@/lib/security';
export async function GET(req: Request) {
  const jar = await cookies();
  try {
    const p = new URL(req.url).searchParams;
    if (p.has('error')) throw new HttpError(400, 'Google permission was not granted');
    const state = JSON.parse(unseal(p.get('state') || ''));
    if (state.exp < Date.now() || !equal(state.nonce, jar.get('mt_oauth')?.value || ''))
      throw new HttpError(400, 'Authorization session expired. Start again.');
    jar.delete('mt_oauth');
    if (state.uid && (await currentUser())?.id !== state.uid)
      throw new HttpError(403, 'Sign-in session changed. Start again.');
    const t = await exchange(p.get('code') || '', state.verifier);
    if (!scopes.filter((s) => s.startsWith('https:')).every((s) => t.scope.split(' ').includes(s)))
      throw new HttpError(400, 'Both Gmail read and send permissions are needed.');
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${t.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new HttpError(400, 'Google identity could not be verified');
    const identity = await res.json();
    if (!identity.email_verified || !identity.sub || !identity.email)
      throw new HttpError(400, 'A verified Google email is required');
    const email = identity.email.toLowerCase();
    let userId = state.uid;
    let invitation;
    if (state.inviteId) {
      [invitation] = await query(
        'SELECT * FROM invitations WHERE id=$1 AND used_at IS NULL AND expires_at>now()',
        [state.inviteId],
      );
      if (!invitation || email !== invitation.email || email !== state.expectedEmail)
        throw new HttpError(403, 'Sign in with the exact invited email address');
      userId = invitation.user_id;
    }
    if (!userId) {
      const allowed = (process.env.ALLOWED_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length && !allowed.includes(email))
        throw new HttpError(
          403,
          'This workspace is private. Your address is not on the allowed list.',
        );
      const [user] = await query(
        'INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name RETURNING id',
        [id(), identity.sub, email, identity.name || email],
      );
      userId = user.id;
    }
    const [old] = await query(
      'SELECT refresh_token FROM accounts WHERE user_id=$1 AND google_sub=$2',
      [userId, identity.sub],
    );
    if (!t.refresh_token && !old)
      throw new HttpError(
        400,
        'Offline permission is missing. Remove MailTrack from Google account access, then reconnect.',
      );
    const values = [
      id(),
      userId,
      identity.sub,
      email,
      seal(t.access_token),
      t.refresh_token ? seal(t.refresh_token) : old.refresh_token,
      new Date(Date.now() + t.expires_in * 1000),
    ];
    const upsert = `ON CONFLICT(user_id,google_sub) DO UPDATE SET email=EXCLUDED.email,access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at,status='connected' RETURNING id`;
    if (invitation) {
      // Claim the one-use invitation and save access in one transaction / statement.
      const saved = await query(
        `WITH approved AS (UPDATE invitations SET used_at=now() WHERE id=$8 AND used_at IS NULL AND expires_at>now() RETURNING id) INSERT INTO accounts(id,user_id,google_sub,email,access_token,refresh_token,expires_at) SELECT $1,$2,$3,$4,$5,$6,$7 FROM approved ${upsert}`,
        [...values, invitation.id],
      );
      if (!saved.length) throw new HttpError(400, 'Approval link already used or expired');
    } else
      await query(
        `INSERT INTO accounts(id,user_id,google_sub,email,access_token,refresh_token,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) ${upsert}`,
        values,
      );
    if (invitation) return Response.redirect(`${origin()}/approved`);
    await createSession(userId);
    return Response.redirect(`${origin()}/?connected=1`);
  } catch (e) {
    jar.delete('mt_oauth');
    const message =
      e instanceof HttpError
        ? e.message
        : 'Google connection failed. Check your configuration and try again.';
    return Response.redirect(`${origin()}/?error=${encodeURIComponent(message)}`);
  }
}
