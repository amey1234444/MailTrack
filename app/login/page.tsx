import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCheck, ShieldCheck, ArrowLeft } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { configured } from '@/lib/security';
import ConnectForm from '@/components/connect-form';
export const dynamic = 'force-dynamic';
export default async function Login() {
  let unavailable = false;
  let user = null;
  const ready = configured();
  if (ready) {
    try {
      user = await currentUser();
    } catch {
      unavailable = true;
    }
  }
  if (user) redirect('/workspace');
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Link href="/" className="brand">
          <CheckCheck /> mailtrack.
        </Link>
        <div>
          <span className="eyebrow">A WORKSPACE THAT’S YOURS</span>
          <h1>
            Good conversations
            <br />
            deserve a thoughtful
            <br />
            <em>follow-up.</em>
          </h1>
          <p>
            Bring your mailbox, tracked emails, and documents together. Your workspace starts empty,
            ready for your first conversation.
          </p>
        </div>
        <span>
          <ShieldCheck size={18} /> Encrypted credentials. Explicit permission.
        </span>
      </aside>
      <section className="auth-content">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO MAILTRACK</span>
          <h1>Let’s connect your mailbox.</h1>
          <p>
            Sign in or create your workspace with your Gmail address and a dedicated Google App
            Password.
          </p>
          {!ready || unavailable ? (
            <div role="alert" className="auth-alert">
              <h2>
                {unavailable
                  ? 'Your workspace is temporarily unavailable'
                  : 'This deployment needs configuration'}
              </h2>
              <p>
                {unavailable
                  ? 'The database could not be reached. Please try again later or contact the deployment owner.'
                  : 'The deployment owner needs to configure the database and encryption key before accounts can connect.'}
              </p>
              <Link className="button secondary" href="/login">
                Try again
              </Link>
            </div>
          ) : (
            <ConnectForm />
          )}
          <p className="auth-footnote">
            No regular Google password. No OAuth client credentials.
            <br />
            <Link href="/help">Need help connecting?</Link> ·{' '}
            <Link href="/privacy">Privacy & access</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
