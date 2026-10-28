import Link from 'next/link';
import {
  ArrowRight,
  CheckCheck,
  Eye,
  Link2,
  FileText,
  ShieldCheck,
  MessageSquare,
  Mail,
} from 'lucide-react';
export default function Home() {
  return (
    <main className="marketing">
      <nav className="marketing-nav">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <CheckCheck />
          </span>
          mailtrack.
        </Link>
        <div>
          <Link href="/help">How it works</Link>
          <Link href="/login" className="button secondary">
            Sign in
          </Link>
        </div>
      </nav>
      <section className="marketing-hero">
        <div>
          <span className="eyebrow">YOUR EMAIL, WITH MORE CONTEXT</span>
          <h1>
            Send with purpose.
            <br />
            <em>Follow up with clarity.</em>
          </h1>
          <p>
            A private workspace for your conversations, email activity, and shared documents.
            Connect your mailbox and start with your own data.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="button primary">
              Create your workspace <ArrowRight size={18} />
            </Link>
            <Link href="/help">See how it works ↗</Link>
          </div>
          <span className="hero-note">
            <ShieldCheck size={16} /> Permission-based access. No Google OAuth setup.
          </span>
        </div>
        <aside className="product-story">
          <span className="eyebrow">ONE CONNECTED WORKSPACE</span>
          <div className="story-orbit">
            <Mail size={42} />
          </div>
          <h2>
            Every conversation.
            <br />A clearer next step.
          </h2>
          <div className="story-row">
            <Eye />
            Email activity<span>Opens & clicks</span>
          </div>
          <div className="story-row">
            <FileText />
            Shared documents<span>Page activity</span>
          </div>
          <div className="story-row">
            <MessageSquare />
            Mailbox context<span>Messages & replies</span>
          </div>
          <p>
            Activity signals help you follow up. They don’t prove that a person read your message.
          </p>
        </aside>
      </section>
      <section className="feature-grid">
        {[
          {
            icon: Eye,
            title: 'Know when activity happens',
            text: 'View recorded opens and link clicks in a timeline for messages sent through MailTrack.',
          },
          {
            icon: FileText,
            title: 'Give documents a home',
            text: 'Share tracked PDF links and review page activity from the same workspace.',
          },
          {
            icon: ShieldCheck,
            title: 'Keep access intentional',
            text: 'Connect your own account or invite another owner to explicitly approve mailbox access.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={25} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="marketing-footer">
        <span>mailtrack. · A little more clarity.</span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Connection guide</Link>
        </div>
      </footer>
    </main>
  );
}
