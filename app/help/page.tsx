import Link from 'next/link';
export default function Help() {
  return (
    <main className="public-page">
      <Link className="brand" href="/">
        mailtrack.
      </Link>
      <article className="public-card">
        <span className="eyebrow">GETTING STARTED</span>
        <h1>Your first connected conversation.</h1>
        <h2>1. Prepare your mailbox</h2>
        <p>
          Enable 2-Step Verification in your Google account, then create a dedicated{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
            App Password
          </a>
          . Some organization policies and account security settings disable this feature. Your
          normal Google password will not work.
        </p>
        <h2>2. Sign in and connect</h2>
        <p>
          Enter your email and App Password on the sign-in page. First-time users get an empty
          workspace; returning users return to their saved workspace. The deployment operator stores
          your App Password encrypted and controls the encryption key. Connect only to an operator
          you trust.
        </p>
        <h2>3. Sync your mailbox</h2>
        <p>
          Open Accounts and choose Sync mailbox. Larger mailboxes need multiple batches.
          Synchronization is periodic, not instantaneous.
        </p>
        <h2>4. Send a tracked email</h2>
        <p>
          Compose your message inside MailTrack. Include links or a tracked PDF to collect activity.
          Messages previously sent, or sent directly from Gmail, do not gain tracking.
        </p>
        <h2>Understand the signals</h2>
        <p>
          An open records an image request. Privacy proxies, security scanners and image blocking
          affect results. Link and PDF events also do not prove human attention. Replies appear
          after mailbox synchronization.
        </p>
        <h2>Disconnect whenever you need</h2>
        <p>
          Disconnect in Accounts to delete stored connection data. Delete the App Password in Google
          settings to invalidate the credential itself.
        </p>
        <Link href="/login" className="button primary">
          Open your workspace →
        </Link>
      </article>
    </main>
  );
}
