'use client';
import { useState, type FormEvent } from 'react';
export default function ConnectForm({ invite, email = '' }: { invite?: string; email?: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
          consent: data.get('consent') === 'on',
          invite,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Connection failed');
      window.location.assign(result.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="connect-form">
      <label>
        Gmail or Google Workspace email
        <input
          name="email"
          type="email"
          defaultValue={email}
          readOnly={!!email}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Google App Password
        <input
          name="password"
          type="password"
          autoComplete="off"
          maxLength={100}
          placeholder="16-letter App Password"
          required
        />
      </label>
      <p>
        Create an App Password after enabling 2-Step Verification. Use a dedicated password for this
        deployment. Never enter your normal Google password. Some account policies disable App
        Passwords.
      </p>
      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
        Create a Google App Password ↗
      </a>
      <label className="connect-consent">
        <input type="checkbox" name="consent" required />I authorize this workspace to store my App
        Password encrypted, read my mailbox, and send emails. I trust the deployment operator with
        this access.
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? 'Verifying mailbox…' : invite ? 'Approve mailbox access' : 'Connect and continue'}
      </button>
      <p className="muted">
        Disconnect deletes the stored connection. To invalidate the App Password itself, delete it
        in your Google account settings.
      </p>
    </form>
  );
}
