import { ShieldCheck } from 'lucide-react';
export default function Approved() {
  return (
    <main className="public-page">
      <section className="public-card">
        <ShieldCheck size={40} color="#8da873" />
        <h1>Permission granted.</h1>
        <p>
          Your mailbox is now connected to the requesting workspace. You can close this page. The
          workspace owner can sync your mailbox and send tracked messages from it.
        </p>
        <p className="muted">
          You can stop future access in{' '}
          <a href="https://myaccount.google.com/permissions">Google Account permissions</a>. The
          workspace owner can disconnect the mailbox to delete stored information.
        </p>
      </section>
    </main>
  );
}
