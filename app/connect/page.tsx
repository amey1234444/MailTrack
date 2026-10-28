import ConnectForm from '@/components/connect-form';
export default function Connect() {
  return (
    <main className="public-page">
      <a className="brand" href="/">
        mailtrack.
      </a>
      <section className="public-card">
        <h1>Connect your Gmail mailbox</h1>
        <p>
          No Google Cloud project, OAuth client ID, or client secret is needed. Your mailbox
          credentials are verified over encrypted IMAP and SMTP connections.
        </p>
        <ConnectForm />
        <a href="/privacy">Privacy and access details</a>
      </section>
    </main>
  );
}
