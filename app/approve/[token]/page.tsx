import { query } from '@/lib/db';
import { hash } from '@/lib/security';
import { CheckCheck, ShieldCheck, ArrowRight } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function Approve({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite] = await query(
    'SELECT i.email,i.expires_at,u.email AS owner FROM invitations i JOIN users u ON u.id=i.user_id WHERE i.token_hash=$1 AND i.used_at IS NULL AND i.expires_at>now()',
    [hash(token)],
  );
  return (
    <main className="public-page">
      <a className="brand" href="/">
        <span className="brand-icon">
          <CheckCheck size={25} />
        </span>
        mailtrack.
      </a>
      <section className="public-card">
        <ShieldCheck size={35} color="#8da873" />
        <h1>{invite ? 'A request for your permission.' : 'This invitation is unavailable.'}</h1>
        {invite ? (
          <>
            <p>
              <strong>{invite.owner}</strong> wants to connect <strong>{invite.email}</strong> to
              their MailTrack workspace.
            </p>
            <h2>Approving gives this workspace owner permission to:</h2>
            <ul>
              <li>
                Sync metadata for all email in your Gmail account, including sent mail, inbox,
                drafts, spam and trash.
              </li>
              <li>Read message content on demand and send emails from your account.</li>
              <li>View tracking activity for emails sent through MailTrack after connection.</li>
            </ul>
            <p>
              Only approve if you trust this person with your mailbox. Sign in to the exact invited
              Google account. Google will ask for read and send permissions. This does not grant you
              access to their workspace.
            </p>
            <a
              className="button primary"
              href={`/api/auth/google?invite=${encodeURIComponent(token)}`}
            >
              Review permission with Google
              <ArrowRight size={17} />
            </a>
            <p className="muted">
              You can revoke access at any time in{' '}
              <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.
              Revocation stops future API access; ask the workspace owner to disconnect the account
              to delete stored data. <a href="/privacy">Read the privacy details.</a>
            </p>
          </>
        ) : (
          <p>
            It may have expired, been revoked or already been approved. Ask the workspace owner for
            a new invitation.
          </p>
        )}
      </section>
    </main>
  );
}
