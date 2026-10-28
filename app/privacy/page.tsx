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
          We use Google OAuth with Gmail read-only and send permissions. Your Google password never
          reaches MailTrack. Invited account owners must sign in as the exact invited email and
          approve access. Approval lets the requesting workspace owner sync mailbox metadata, read
          message content and send email.
        </p>
        <h2>What is stored</h2>
        <p>
          Profile name and email, encrypted Google tokens, mailbox headers and snippets, sent
          message content, recipient addresses, PDFs you upload, and tracking events with
          timestamps. Full synced message bodies are fetched on demand and are not persisted.
          Session tokens are stored as hashes. Tokens are encrypted using AES-256-GCM.
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
          delete your workspace. Disconnecting revokes the Google grant and deletes associated
          mailbox and tracking records. Deleting the workspace also deletes uploaded documents.
          Expired sessions and invitations are periodically removed. Operators control database
          backups and infrastructure-log retention.
        </p>
        <h2>Revoke access</h2>
        <p>
          Use Accounts → Disconnect in the workspace or{' '}
          <a href="https://myaccount.google.com/permissions">Google Account permissions</a> to stop
          Gmail access. If you approved someone else’s workspace, ask its owner to disconnect your
          account to remove previously stored data. Revoking a Google grant can require reconnection
          in other workspaces using the same grant.
        </p>
        <h2>Google API data use</h2>
        <p>
          MailTrack uses Google user data only to provide the mailbox and tracking features you
          authorize. It does not sell that data, use it for advertising, or use it to train AI
          models. Deployment operators must comply with Google’s API Services User Data Policy and
          Limited Use requirements, and configure verification and privacy contact details for their
          deployment.
        </p>
        <a className="button secondary" href="/">
          Back to workspace
        </a>
      </article>
    </main>
  );
}
