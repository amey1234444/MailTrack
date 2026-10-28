import { CheckCheck } from 'lucide-react';
export default function Privacy() {
  return (
    <main className="public-page">
      <a className="brand" href="/">
        <span className="brand-icon">
          <CheckCheck size={25} />
        </span>
        mailtrack.
      </a>
      <article className="public-card">
        <h1>A clearer picture. Honest boundaries.</h1>
        <p>
          MailTrack is a self-hosted Gmail analytics workspace. The person operating this deployment
          is responsible for its data, access controls and use. This page describes the
          application’s behavior; operators should add their organization and contact details before
          inviting external users.
        </p>
        <h2>Account access requires permission</h2>
        <p>
          New connections use Gmail SMTP and IMAP with a Google App Password. The App Password
          reaches this server and is stored encrypted; the deployment operator controls the
          encryption key. Never provide your regular Google password. Invited account owners must
          verify the exact invited email and approve access. Approval lets the requesting workspace
          owner sync mailbox metadata, read message content and send email.
        </p>
        <h2>What is stored</h2>
        <p>
          Profile name and email, encrypted App Passwords (or tokens for legacy OAuth connections),
          mailbox headers and snippets, sent message content, recipient addresses, PDFs you upload,
          and tracking events with timestamps. Full synced message bodies are fetched on demand and
          are not persisted. Session tokens are stored as hashes. Tokens are encrypted using
          AES-256-GCM.
        </p>
        <h2>What tracking means</h2>
        <p>
          An open event means a tracking image was requested. It does not prove a human opened or
          read the email. Privacy proxies, image caches, security scanners, previews and image
          blocking can cause missing or additional events. We flag some known automation and proxies
          using a temporary user-agent check, which is only a heuristic. Raw IP addresses and user
          agents are not stored by the application; hosting providers may maintain infrastructure
          logs.
        </p>
        <p>
          Activity is associated with the intended recipient of an individual copy. A forwarded link
          or message keeps that association. MailTrack cannot identify unknown viewers, establish
          forwarding, reliably report device or precise location, measure comprehension, or predict
          a hiring decision.
        </p>
        <h2>Links and documents</h2>
        <p>
          Tracked links record a request before redirecting to the stored destination. PDF links
          grant access to anyone possessing the link. The viewer records page activity and
          visible-tab time in short intervals; these metrics do not prove attention. Download
          activity is recorded, but subsequent offline reading cannot be tracked. Deleting a PDF
          revokes its viewer links. Email composition includes a disclosure that tracking is
          enabled.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          Workspace content is retained until you delete the document, disconnect the mailbox, or
          delete your workspace. Disconnecting deletes the stored mailbox credentials and associated
          mailbox and tracking records. Deleting the workspace also deletes uploaded documents.
          Expired sessions and invitations are periodically removed. Operators control database
          backups and infrastructure-log retention.
        </p>
        <h2>Revoke access</h2>
        <p>
          Use Accounts → Disconnect in the workspace or{' '}
          <a href="https://myaccount.google.com/apppasswords">Google App Password settings</a> to
          stop Gmail access. If you approved someone else’s workspace, ask its owner to disconnect
          your account to remove previously stored data. Delete the App Password in Google settings
          to invalidate it everywhere it was used.
        </p>
        <h2>Mailbox data use</h2>
        <p>
          MailTrack uses Google user data only to provide the mailbox and tracking features you
          authorize. It does not sell that data, use it for advertising, or use it to train AI
          models. Operators must publish their privacy contact details and comply with the
          applicable provider policies. New App Password connections do not use the Gmail API.
        </p>
        <a className="button secondary" href="/">
          Back to workspace
        </a>
      </article>
    </main>
  );
}
