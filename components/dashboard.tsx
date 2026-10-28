'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Flame,
  Inbox,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
  AlertCircle,
  ExternalLink,
  Paperclip,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  AccountView,
  DocumentView,
  DashboardData,
  MessageDetail,
  MessageView,
  MailboxView,
} from '@/lib/ui-types';
import DocumentAnalytics from './document-analytics';
import { demoAccount } from '@/lib/demo';
type Tab = 'Overview' | 'Tracked emails' | 'Mailbox' | 'Documents' | 'Accounts' | 'Settings';
type User = { name: string; email: string; timezone: string };
const emptyData: DashboardData = {
  messages: [],
  hasMore: false,
  stats: { sent: 0, opens: 0, clicks: 0, replies: 0, document_views: 0 },
  activity: [],
  chart: [],
};
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${r.status})`);
  }
  return r.json();
}
function iconFor(kind: string) {
  return kind === 'open'
    ? Eye
    : kind === 'click'
      ? Link2
      : kind === 'reply'
        ? MessageSquare
        : FileText;
}
const labels: Record<string, string> = {
  open: 'Open recorded',
  click: 'Link clicked',
  reply: 'Reply received',
  document_view: 'Document viewed',
  page_view: 'PDF page activity',
  download: 'PDF downloaded',
};
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Badge({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export default function Dashboard({
  user,
  configured,
  databaseError,
  sample,
}: {
  user: User | null;
  configured: boolean;
  databaseError: boolean;
  sample: DashboardData;
}) {
  const demoData = sample;
  const [documentAnalytics, setDocumentAnalytics] = useState<string | null>(null);
  const demo = !user;
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<DashboardData>(demo ? demoData : emptyData);
  const [accounts, setAccounts] = useState<AccountView[]>(demo ? [demoAccount] : []);
  const [docs, setDocs] = useState<DocumentView[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [compose, setCompose] = useState(false);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [notify, setNotify] = useState(false);
  const latestEvent = useRef<string | null>(null);
  const time = useCallback(
    (v: string | null, full = false) =>
      v
        ? new Intl.DateTimeFormat('en-IN', {
            timeZone: timezone,
            month: 'short',
            day: 'numeric',
            ...(full ? { year: 'numeric' } : {}),
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(v))
        : '—',
    [timezone],
  );
  const load = useCallback(
    async (silent = false) => {
      if (demo) return;
      if (!silent) setLoading(true);
      try {
        const [next, a, d] = await Promise.all([
          api<DashboardData>(`/api/dashboard?q=${encodeURIComponent(search)}&page=${page}`),
          api<AccountView[]>('/api/accounts'),
          api<DocumentView[]>('/api/documents'),
        ]);
        setData(next);
        setAccounts(a);
        setDocs(d);
        setLastUpdated(new Date());
        if (
          notify &&
          next.activity[0] &&
          latestEvent.current &&
          latestEvent.current !== next.activity[0].id &&
          Notification.permission === 'granted'
        )
          new Notification('New MailTrack activity', {
            body: `${labels[next.activity[0].kind] || 'Activity'} · ${next.activity[0].subject}`,
          });
        latestEvent.current = next.activity[0]?.id || null;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [demo, search, page, notify],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (demo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [demo, load]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('error')) setError(p.get('error')!);
    if (p.has('connected')) {
      setNotice('Mailbox connected. Use Sync mailbox to import your email history.');
      setTab('Accounts');
    }
    if (p.has('setup')) setShowConnect(true);
  }, []);
  const action = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  function connect() {
    if (configured) window.location.href = '/api/auth/google';
    else setShowConnect(true);
  }
  async function sync(accountId?: string) {
    if (demo) {
      connect();
      return;
    }
    setSyncing(true);
    setError('');
    let total = 0;
    try {
      const chosen = accountId
        ? accounts.filter((a) => a.id === accountId)
        : accounts.filter((a) => a.status === 'connected');
      for (const a of chosen) {
        let more = true;
        let batches = 0;
        while (more && batches < 20) {
          const r = await api<{ more: boolean; processed: number; busy?: boolean }>('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ accountId: a.id }),
          });
          total += r.processed;
          more = r.more;
          batches++;
          setNotice(`Syncing ${a.email} · ${total} messages processed`);
          if (r.busy) break;
        }
        if (more) setNotice('Sync progress saved. Click Sync again to continue importing.');
        else setNotice(`Mailbox up to date · ${total} messages processed`);
      }
      await load(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }
  async function openMessage(m: MessageView) {
    if (demo) {
      setDetail({
        message: {
          id: m.id,
          subject: m.subject,
          sender: m.sender,
          body: 'This is a sample message in the demo workspace. Connect your Gmail account to send tracked emails and see your own activity here.',
        },
        deliveries: [
          {
            id: 'sample',
            recipient: 'jordan@example.com',
            recipient_type: 'to',
            status: 'sent',
            error: null,
            sent_at: m.created_at,
            replied_at: m.replies ? m.last_activity : null,
            opens: m.opens,
            clicks: m.clicks,
            first_open: m.last_activity,
          },
        ],
        events: demoData.activity
          .filter((a) => a.message_id === m.id)
          .map((a) => ({ ...a, detail: {} })),
        eventLimit: 500,
      });
      return;
    }
    await action(async () => setDetail(await api(`/api/messages/${m.id}`)));
  }
  const tabs: { name: Tab; icon: LucideIcon }[] = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Tracked emails', icon: Mail },
    { name: 'Mailbox', icon: Inbox },
    { name: 'Documents', icon: FileText },
    { name: 'Accounts', icon: Users },
    { name: 'Settings', icon: Settings },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
        <a href="/" className="brand">
          <span className="brand-icon">
            <CheckCheck size={25} />
          </span>
          mailtrack<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <div className="avatar">{(user?.name || 'Demo workspace')[0]}</div>
          <div>
            <strong>{user ? `${user.name.split(' ')[0]}’s workspace` : 'Demo workspace'}</strong>
            <span>{demo ? 'Explore what’s possible' : 'Personal workspace'}</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {tabs.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => {
                setTab(name);
                setSidebar(false);
                setSearch('');
                setPage(0);
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === 'Tracked emails' && <span className="nav-count">{data.stats.sent}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="clarity-card">
            <ShieldCheck size={22} />
            <strong>Clarity, with context.</strong>
            <p>
              Activity is a signal.
              <br />A reply is a conversation.
            </p>
            <a href="/privacy">
              How tracking works <ArrowUpRight size={14} />
            </a>
          </div>
          <button className="profile" onClick={() => setTab('Settings')}>
            <span className="profile-avatar">
              {(user?.name || 'Alex Morgan')
                .split(' ')
                .map((x) => x[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              <strong>{user?.name || 'Alex Morgan'}</strong>
              <small>{demo ? 'Sample account' : 'Workspace owner'}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{tab}</strong>
          </div>
          <div className="top-actions">
            <span className="live-indicator">
              <i />
              {demo ? 'Demo mode' : lastUpdated ? 'Connected' : 'Your workspace'}
            </span>
            <a
              href="https://github.com/amey1234444/MailTrack"
              target="_blank"
              rel="noreferrer"
              className="help-link"
            >
              Project <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <div className="content">
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="tiny-label">DEMO</span> Take a look around. Everything below is
                sample data.
              </span>
              <button onClick={connect}>
                Connect your Gmail <ArrowRight size={16} />
              </button>
            </div>
          )}
          {databaseError && (
            <div className="alert error">
              The database could not be reached. Check DATABASE_URL and run the migration.
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR EMAIL, A LITTLE CLEARER</div>
              <h1>{tab === 'Overview' ? 'Good things start with a conversation.' : tab}</h1>
              <p>
                {
                  {
                    Overview: 'A thoughtful overview of what happens after you hit send.',
                    'Tracked emails': 'Every message, every recorded interaction, in one place.',
                    Mailbox:
                      'Your connected mailbox history. Existing emails do not have retroactive open tracking.',
                    Documents: 'Share PDFs with a dedicated viewer and page-level activity.',
                    Accounts: 'Connect a mailbox or ask its owner for permission.',
                    Settings: 'Make this workspace yours. Keep control of your data.',
                  }[tab]
                }
              </p>
            </div>
            {['Overview', 'Tracked emails', 'Mailbox'].includes(tab) && (
              <button className="button primary" onClick={() => setCompose(true)}>
                <Plus size={18} />
                Compose email
              </button>
            )}
            {tab === 'Documents' && (
              <label className="button primary">
                <Plus size={18} />
                Upload PDF
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (demo) {
                      connect();
                      return;
                    }
                    void action(async () => {
                      const form = new FormData();
                      form.set('file', f);
                      await api('/api/documents', { method: 'POST', body: form });
                      await load(true);
                      setNotice('PDF uploaded. Add it to a tracked email to share it.');
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          {tab === 'Overview' && (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: 'Emails sent',
                    value: data.stats.sent,
                    icon: Send,
                    note: 'Individual deliveries',
                    tone: 'neutral',
                  },
                  {
                    label: 'Recorded opens',
                    value: data.stats.opens,
                    icon: Eye,
                    note: 'Image loads detected',
                    tone: 'lime',
                  },
                  {
                    label: 'Link clicks',
                    value: data.stats.clicks,
                    icon: Link2,
                    note: 'Tracked URL visits',
                    tone: 'purple',
                  },
                  {
                    label: 'Replies received',
                    value: data.stats.replies,
                    icon: MessageSquare,
                    note: 'Conversations continued',
                    tone: 'blue',
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-title">
                      {s.label}
                      <span className={`stat-icon ${s.tone}`}>
                        <s.icon size={18} />
                      </span>
                    </div>
                    <div className="stat-value">
                      {s.value.toLocaleString()}
                      {demo && (
                        <span className="mini-spark" aria-hidden="true">
                          ▂▃▂▅▄▆▅▇
                        </span>
                      )}
                    </div>
                    <div className="stat-note">
                      {s.label === 'Replies received' ? (
                        <span className="green-dot" />
                      ) : (
                        <span className="muted-dot" />
                      )}
                      {s.note}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A little momentum</h2>
                      <p>Recorded engagement over the last 7 days</p>
                    </div>
                    <span className="pill">
                      <Clock size={14} />
                      Last 7 days
                    </span>
                  </div>
                  <ActivityChart data={data.chart} timezone={timezone} />
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot lime" />
                      Recorded opens
                    </span>
                    <span>
                      <i className="legend-dot purple" />
                      Link clicks
                    </span>
                    <small>Displayed in {timezone}</small>
                  </div>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <h2>Latest activity</h2>
                    <span className="activity-live">{demo ? 'Sample' : 'Recent'}</span>
                  </div>
                  <div className="activity-list">
                    {data.activity.slice(0, 4).map((a) => {
                      const Icon = iconFor(a.kind);
                      return (
                        <button
                          className="activity-item"
                          key={a.id}
                          onClick={() => {
                            const m = data.messages.find((m) => m.id === a.message_id);
                            if (m) void openMessage(m);
                            else
                              void action(async () =>
                                setDetail(await api(`/api/messages/${a.message_id}`)),
                              );
                          }}
                        >
                          <span className={`activity-icon ${a.kind}`}>
                            <Icon size={17} />
                          </span>
                          <span>
                            <strong>{labels[a.kind] || a.kind}</strong>
                            <p>{a.recipient}</p>
                            <small>
                              {time(a.occurred_at)}
                              {a.automated ? ' · Possible automation' : ''}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                    {!data.activity.length && (
                      <Empty
                        icon={Eye}
                        title="The next chapter is unwritten"
                        text="Send your first tracked email. Recorded activity will appear here."
                      />
                    )}
                  </div>
                  <button className="panel-footer" onClick={() => setTab('Tracked emails')}>
                    Explore your emails <ArrowRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {['Overview', 'Tracked emails'].includes(tab) && (
            <section className="panel message-panel">
              <div className="panel-heading">
                <div>
                  <h2>{tab === 'Overview' ? 'Your recent conversations' : 'All tracked emails'}</h2>
                  <p>Small signals. A fuller picture.</p>
                </div>
                <div className="table-actions">
                  {tab === 'Overview' ? (
                    <button className="text-button" onClick={() => setTab('Tracked emails')}>
                      View all emails <ArrowUpRight size={16} />
                    </button>
                  ) : (
                    <a
                      className="button secondary small"
                      href={demo ? undefined : '/api/export'}
                      onClick={(e) => {
                        if (demo) {
                          e.preventDefault();
                          connect();
                        }
                      }}
                    >
                      <ArrowDownToLine size={16} />
                      Export CSV
                    </a>
                  )}
                </div>
              </div>
              <div className="table-toolbar">
                <div className="table-filter">
                  <span className="selected">All emails</span>
                  <span>{data.stats.sent} sent</span>
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search tracked emails"
                    placeholder="Search conversations…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CONVERSATION</th>
                      <th>STATUS</th>
                      <th>OPENS</th>
                      <th>CLICKS</th>
                      <th>LAST ACTIVITY</th>
                      <th aria-label="Details" />
                    </tr>
                  </thead>
                  <tbody>
                    {(demo
                      ? data.messages.filter((m) =>
                          m.subject.toLowerCase().includes(search.toLowerCase()),
                        )
                      : data.messages
                    ).map((m, i) => (
                      <tr key={m.id} onClick={() => void openMessage(m)}>
                        <td>
                          <div className="email-cell">
                            <span className={`email-avatar color-${i % 4}`}>
                              <Mail size={18} />
                            </span>
                            <span>
                              <button
                                className="subject-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openMessage(m);
                                }}
                              >
                                {m.subject}
                              </button>
                              <small>
                                {m.recipients} recipient{m.recipients === 1 ? '' : 's'}{' '}
                                <span>·</span> {time(m.created_at)}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          {m.issues ? (
                            <Badge tone="amber">Needs review</Badge>
                          ) : m.replies ? (
                            <Badge tone="blue">
                              <MessageSquare size={12} />
                              Replied
                            </Badge>
                          ) : m.opens ? (
                            <Badge>
                              <CheckCheck size={13} />
                              Open recorded
                            </Badge>
                          ) : (
                            <Badge tone="gray">
                              <Check size={13} />
                              Sent
                            </Badge>
                          )}
                        </td>
                        <td>
                          <span className="number-cell">
                            {m.opens}
                            {m.recent_opens >= 3 && (
                              <span title="3 or more pixel loads in 10 minutes; forwarding is not verified">
                                <Flame size={14} className="flame" />
                              </span>
                            )}
                          </span>
                        </td>
                        <td>{m.clicks}</td>
                        <td className="date-cell">{time(m.last_activity)}</td>
                        <td>
                          <ChevronRight size={16} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.messages.length && (
                <Empty
                  icon={Mail}
                  title={loading ? 'Loading conversations…' : 'Make your first connection'}
                  text="Compose a tracked email to start a conversation and see its activity."
                />
              )}
              {tab === 'Tracked emails' && (
                <div className="pagination">
                  <button
                    className="button secondary small"
                    disabled={!page}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>
                  <span>Page {page + 1}</span>
                  <button
                    className="button secondary small"
                    disabled={!data.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === 'Mailbox' && (
            <Mailbox
              accounts={accounts}
              demo={demo}
              time={time}
              sync={sync}
              syncing={syncing}
              onError={setError}
              connect={connect}
            />
          )}
          {tab === 'Documents' && (
            <>
              <div className="info-box">
                <FileText size={21} />
                <div>
                  <strong>More than an attachment.</strong>
                  <p>
                    Upload a PDF, add it to a tracked email, and share a recipient-specific viewer
                    link. Supports PDFs up to 3 MB and 200 pages.
                  </p>
                </div>
              </div>
              <div className="document-grid">
                {docs.map((d) => (
                  <div className="panel document-card" key={d.id}>
                    <div className="document-cover">
                      <FileText size={48} />
                      <span>PDF</span>
                    </div>
                    <h3>{d.name}</h3>
                    <button className="text-button" onClick={() => setDocumentAnalytics(d.id)}>
                      View analytics <ArrowUpRight size={14} />
                    </button>
                    <p>
                      {d.pages} pages · {(d.bytes / 1024).toFixed(0)} KB
                    </p>
                    <div>
                      <span>{time(d.created_at)}</span>
                      <button
                        className="icon-button danger"
                        aria-label={`Delete ${d.name}`}
                        onClick={() => {
                          if (window.confirm('Delete this PDF and revoke all viewer links?'))
                            void action(async () => {
                              await api(`/api/documents/${d.id}`, { method: 'DELETE' });
                              await load(true);
                            });
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!docs.length && (
                <section className="panel">
                  <Empty
                    icon={FileText}
                    title="A home for your next proposal"
                    text="Upload a PDF to start sharing documents with page-view and viewing-time analytics."
                  />
                </section>
              )}
            </>
          )}
          {tab === 'Accounts' && (
            <Accounts
              accounts={accounts}
              demo={demo}
              connect={connect}
              sync={sync}
              syncing={syncing}
              load={load}
              action={action}
              notice={setNotice}
              time={time}
            />
          )}
          {tab === 'Settings' && (
            <section className="panel settings-panel">
              <div>
                <h2>Workspace preferences</h2>
                <p>Times are displayed in your chosen timezone. CSV exports use UTC.</p>
                <label className="field">
                  Timezone
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {[
                      ...new Set([
                        timezone,
                        'Asia/Kolkata',
                        'UTC',
                        'America/New_York',
                        'America/Los_Angeles',
                        'Europe/London',
                        'Asia/Singapore',
                        'Australia/Sydney',
                      ]),
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="button primary"
                  onClick={() => {
                    if (demo) {
                      setNotice('Demo timezone updated for this view.');
                      return;
                    }
                    void action(async () => {
                      await api('/api/settings', {
                        method: 'PATCH',
                        body: JSON.stringify({ timezone }),
                      });
                      setNotice('Timezone saved.');
                    });
                  }}
                >
                  Save preferences
                </button>
              </div>
              <div>
                <h2>Desktop notifications</h2>
                <p>
                  Get new-activity notifications while this dashboard is open. Proxy and automated
                  requests can trigger them.
                </p>
                <button
                  className="button secondary"
                  onClick={() =>
                    void action(async () => {
                      if (!('Notification' in window))
                        throw new Error('This browser does not support desktop notifications');
                      if (notify) {
                        setNotify(false);
                        return;
                      }
                      const permission = await Notification.requestPermission();
                      setNotify(permission === 'granted');
                      if (permission !== 'granted')
                        setNotice(
                          'Notifications were not enabled. You can change this in browser settings.',
                        );
                    })
                  }
                >
                  {notify ? 'Disable notifications' : 'Enable notifications'}
                </button>
              </div>
              <div>
                <h2>Your data, your choice</h2>
                <p>
                  Disconnect a mailbox in Accounts to revoke Google access and delete its synced
                  messages and analytics. Deleting your workspace also removes your documents and
                  all stored activity.
                </p>
                <div className="button-row">
                  <a className="button secondary" href="/privacy">
                    Privacy & tracking details
                    <ArrowUpRight size={16} />
                  </a>
                  {!demo && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        void action(async () => {
                          await api('/api/auth/logout', { method: 'POST' });
                          window.location.href = '/';
                        })
                      }
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  )}
                </div>
                {!demo && (
                  <button
                    className="button danger-outline"
                    onClick={() => {
                      const confirm = window.prompt(
                        `This permanently deletes your workspace. Type ${user!.email} to confirm.`,
                      );
                      if (confirm)
                        void action(async () => {
                          await api('/api/settings', {
                            method: 'DELETE',
                            body: JSON.stringify({ confirm }),
                          });
                          window.location.href = '/';
                        });
                    }}
                  >
                    Delete workspace and all data
                  </button>
                )}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <ShieldCheck size={15} />
            <span>
              Open events reflect image loads, not proof of reading.{' '}
              <a href="/privacy">Understand the signals</a>
            </span>
            <span className="footer-brand">Made for better conversations.</span>
          </footer>
        </div>
      </main>
      {documentAnalytics && (
        <DocumentAnalytics id={documentAnalytics} close={() => setDocumentAnalytics(null)} />
      )}
      {compose && (
        <Compose
          accounts={accounts}
          docs={docs}
          demo={demo}
          close={() => setCompose(false)}
          connect={connect}
          done={async (result) => {
            setCompose(false);
            setNotice(result);
            await load(true);
          }}
        />
      )}
      {detail && (
        <Modal title="Conversation details" wide onClose={() => setDetail(null)}>
          <div className="detail-body">
            <h3>{detail.message.subject}</h3>
            <p className="muted">From {detail.message.sender}</p>
            <div className="message-preview">{detail.message.body}</div>
            <h3>Recipient activity</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>RECIPIENT</th>
                    <th>DELIVERY</th>
                    <th>OPENS / CLICKS</th>
                    <th>FIRST RECORDED OPEN</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.recipient}
                        <small className="block muted">
                          {d.recipient_type.toUpperCase()} · individual copy
                        </small>
                      </td>
                      <td>
                        <Badge tone={d.status === 'sent' ? 'green' : 'amber'}>{d.status}</Badge>
                        {d.replied_at && (
                          <small className="block">Replied {time(d.replied_at)}</small>
                        )}
                        {d.error && <small className="block danger">{d.error}</small>}
                      </td>
                      <td>
                        {d.opens} / {d.clicks}
                      </td>
                      <td>{time(d.first_open, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="button-row">
              {!demo &&
                detail.deliveries.some((d) => ['pending', 'sending'].includes(d.status)) && (
                  <button
                    className="button secondary small"
                    onClick={() =>
                      void action(async () => {
                        const m = detail.message;
                        let r = await api<{ more: boolean }>(`/api/messages/${m.id}/continue`, {
                          method: 'POST',
                        });
                        while (r.more)
                          r = await api(`/api/messages/${m.id}/continue`, { method: 'POST' });
                        setDetail(await api(`/api/messages/${m.id}`));
                        await load(true);
                      })
                    }
                  >
                    Continue pending deliveries
                  </button>
                )}
            </div>
            <h3>Activity timeline</h3>
            <p className="muted">
              Latest {detail.eventLimit} events. Export CSV for the full history. Identity refers to
              the intended recipient.
            </p>
            <div className="detail-timeline">
              {detail.events.map((e) => {
                const Icon = iconFor(e.kind);
                return (
                  <div key={e.id}>
                    <span className="timeline-icon">
                      <Icon size={17} />
                    </span>
                    <span>
                      <strong>{labels[e.kind] || e.kind}</strong>
                      <p>
                        {e.recipient}{' '}
                        {e.automated && <Badge tone="amber">Possible automation / proxy</Badge>}
                      </p>
                      <small>
                        {time(e.occurred_at, true)}
                        {e.detail.page ? ` · Page ${e.detail.page}` : ''}
                        {e.detail.duration ? ` · ${e.detail.duration}s visible` : ''}
                        {typeof e.detail.url === 'string' ? ` · ${e.detail.url}` : ''}
                      </small>
                    </span>
                  </div>
                );
              })}
              {!detail.events.length && (
                <p className="muted">
                  No activity recorded yet. Image blocking can prevent detection.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
      {showConnect && (
        <Modal title="Connect your real workspace" onClose={() => setShowConnect(false)}>
          <div className="detail-body">
            <div className="setup-icon">
              <ShieldCheck size={30} />
            </div>
            <h3>Your mailbox. Your permission.</h3>
            <p>MailTrack uses Google’s consent screen. It never asks for your Gmail password.</p>
            <div className="info-box">
              <div>
                <strong>Deployment setup required</strong>
                <p>
                  Add the environment variables from .env.example in Vercel, connect PostgreSQL, run
                  the database migration, and configure Google OAuth. Then return here to connect
                  Gmail.
                </p>
              </div>
            </div>
            <a
              className="button primary"
              href="https://github.com/amey1234444/MailTrack#deploy-to-vercel"
              target="_blank"
              rel="noreferrer"
            >
              Open deployment instructions
              <ArrowUpRight size={16} />
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="empty">
      <span>
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function ActivityChart({ data, timezone }: { data: DashboardData['chart']; timezone: string }) {
  const rows = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return {
      label: new Intl.DateTimeFormat('en', { timeZone: timezone, weekday: 'short' }).format(d),
      ...(data.find((r) => r.day === day) || { opens: 0, clicks: 0 }),
    };
  });
  const max = Math.max(10, ...rows.map((r) => r.opens + r.clicks));
  const top = Math.ceil(max / 10) * 10;
  return (
    <div className="chart">
      <div className="chart-y">
        {[top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0].map(
          (n, i) => (
            <span key={i}>{n}</span>
          ),
        )}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} />
          ))}
        </div>
        <div className="chart-bars">
          {rows.map((r, i) => (
            <div className="bar-column" key={i}>
              <div className="bar-space">
                <div
                  className="bar-stack"
                  style={{ height: `${((r.opens + r.clicks) / top) * 100}%` }}
                  title={`${r.label}: ${r.opens} opens, ${r.clicks} clicks`}
                >
                  <div className="bar-click" style={{ flex: r.clicks }} />
                  <div className="bar-open" style={{ flex: r.opens }} />
                </div>
              </div>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Compose({
  accounts,
  docs,
  demo,
  close,
  connect,
  done,
}: {
  accounts: AccountView[];
  docs: DocumentView[];
  demo: boolean;
  close: () => void;
  connect: () => void;
  done: (message: string) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [extras, setExtras] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestKey] = useState(() => crypto.randomUUID());
  const split = (s: string) =>
    s
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  return (
    <Modal
      title="Start a conversation"
      onClose={() => {
        if (!busy) close();
      }}
      wide
    >
      <form
        className="compose"
        onSubmit={async (e) => {
          e.preventDefault();
          if (demo) {
            close();
            connect();
            return;
          }
          setBusy(true);
          setError('');
          try {
            let r = await api<{ id: string; more: boolean; deliveries: { status: string }[] }>(
              '/api/send',
              {
                method: 'POST',
                body: JSON.stringify({
                  accountId,
                  requestKey,
                  to: split(to),
                  cc: split(cc),
                  bcc: split(bcc),
                  subject,
                  body,
                  documentIds: selected,
                }),
              },
            );
            while (r.more) {
              r = await api<typeof r>(`/api/messages/${r.id}/continue`, { method: 'POST' });
            }
            const sent = r.deliveries.filter((d) => d.status === 'sent').length;
            await done(
              `${sent} of ${r.deliveries.length} individual copies sent.${sent < r.deliveries.length ? ' Review delivery details before sending again.' : ''}`,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="compose-field">
          <span>From</span>
          <select required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts
              .filter((a) => a.status === 'connected')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
          </select>
        </label>
        <label className="compose-field">
          <span>To</span>
          <input
            placeholder="name@example.com, another@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button type="button" className="text-button" onClick={() => setExtras(!extras)}>
            Cc / Bcc
          </button>
        </label>
        {extras && (
          <>
            <label className="compose-field">
              <span>Cc</span>
              <input value={cc} onChange={(e) => setCc(e.target.value)} />
            </label>
            <label className="compose-field">
              <span>Bcc</span>
              <input value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </label>
          </>
        )}
        <label className="compose-field">
          <span>Subject</span>
          <input
            required
            maxLength={300}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A good conversation starts here"
          />
        </label>
        <textarea
          aria-label="Email message"
          required
          maxLength={30000}
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi there,&#10;&#10;What would you like to share? Paste links directly into your message to track clicks."
        />
        <div className="compose-documents">
          <span>
            <Paperclip size={16} />
            Tracked documents
          </span>
          {docs.length ? (
            docs.map((d) => (
              <label key={d.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, d.id] : selected.filter((id) => id !== d.id),
                    )
                  }
                />
                {d.name}
              </label>
            ))
          ) : (
            <small>Upload a PDF in Documents to add it here.</small>
          )}
        </div>
        <div className="compose-note">
          <ShieldCheck size={17} />
          <p>
            Each To, Cc, and Bcc address receives a separate, private copy for individual tracking.
            Other recipients are not listed. Up to 20 recipients and 30 distinct links per send. A
            tracking disclosure is included.
          </p>
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div className="compose-footer">
          <span>
            <CheckCheck size={16} />
            Open & link tracking enabled
          </span>
          <button className="button primary" disabled={busy || (!demo && !accountId)}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}{' '}
            {busy ? 'Sending…' : demo ? 'Connect to send' : 'Send tracked email'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Accounts({
  accounts,
  demo,
  connect,
  sync,
  syncing,
  load,
  action,
  notice,
  time,
}: {
  accounts: AccountView[];
  demo: boolean;
  connect: () => void;
  sync: (id?: string) => Promise<void>;
  syncing: boolean;
  load: (silent?: boolean) => Promise<void>;
  action: (fn: () => Promise<void>) => Promise<void>;
  notice: (s: string) => void;
  time: (s: string | null) => string;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [sender, setSender] = useState(accounts[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<
    { id: string; email: string; expires_at: string; used_at: string | null }[]
  >([]);
  const refresh = useCallback(async () => {
    if (!demo) setInvites(await api('/api/invites'));
  }, [demo]);
  useEffect(() => {
    void action(refresh);
  }, [refresh]);
  return (
    <>
      <div className="section-head">
        <h2>
          Connected mailboxes <span className="count-pill">{accounts.length}</span>
        </h2>
        <button className="button secondary" onClick={connect}>
          <Plus size={16} />
          Connect a mailbox
        </button>
      </div>
      <div className="account-grid">
        {accounts.map((a) => (
          <section className="panel account-card" key={a.id}>
            <div className="account-top">
              <span className="gmail-icon">M</span>
              <Badge tone={a.status === 'connected' ? 'green' : 'amber'}>
                {a.status === 'connected' ? 'Connected' : 'Reconnect needed'}
              </Badge>
            </div>
            <h3>{a.email}</h3>
            <p>Gmail · owner-approved access</p>
            <div className="account-meta">
              <span>Last synced</span>
              <strong>{time(a.synced_at)}</strong>
              <span>Initial import</span>
              <strong>{a.sync_complete ? 'Complete' : 'Ready to continue'}</strong>
            </div>
            <div className="button-row">
              <button
                className="button secondary small"
                disabled={syncing}
                onClick={() => void sync(a.id)}
              >
                <RefreshCw size={15} className={syncing ? 'spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync mailbox'}
              </button>
              <button
                className="icon-button danger"
                aria-label={`Disconnect ${a.email}`}
                onClick={() => {
                  if (demo) {
                    connect();
                    return;
                  }
                  if (
                    window.confirm(
                      'Revoke Google access and permanently delete this mailbox’s synced messages and tracking history? Other connections using this Google grant may also need reconnection.',
                    )
                  )
                    void action(async () => {
                      await api(`/api/accounts/${a.id}`, { method: 'DELETE' });
                      await load(true);
                      notice('Mailbox disconnected and its data deleted.');
                    });
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!accounts.length && (
        <section className="panel">
          <Empty
            icon={Inbox}
            title="Connect your first mailbox"
            text="Sign in with Google to authorize Gmail access. Your password stays with Google."
          />
        </section>
      )}
      <section className="panel invitation-panel">
        <div>
          <span className="section-icon">
            <Users size={24} />
          </span>
          <h2>Ask for access. Never assume it.</h2>
          <p>
            Send an invitation to a mailbox owner. They’ll see exactly what access they’re granting
            and sign in with Google to approve it. Invitations expire after 24 hours.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (demo) {
              connect();
              return;
            }
            setBusy(true);
            void action(async () => {
              await api('/api/invites', {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail, accountId: sender }),
              });
              notice(`Permission request sent to ${inviteEmail}`);
              setInviteEmail('');
              await refresh();
            }).finally(() => setBusy(false));
          }}
        >
          <label className="field">
            Send request from
            <select required value={sender} onChange={(e) => setSender(e.target.value)}>
              {accounts
                .filter((a) => a.status === 'connected')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Mailbox owner’s email
            <input
              type="email"
              required
              placeholder="colleague@gmail.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy || !sender}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}Send permission
            request
          </button>
        </form>
      </section>
      {invites.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Permission requests</h2>
          </div>
          {invites.map((i) => (
            <div className="invite-row" key={i.id}>
              <span>
                {i.email}
                <small className="block muted">Expires {time(i.expires_at)}</small>
              </span>
              <Badge
                tone={i.used_at ? 'green' : new Date(i.expires_at) < new Date() ? 'gray' : 'amber'}
              >
                {i.used_at
                  ? 'Approved'
                  : new Date(i.expires_at) < new Date()
                    ? 'Expired'
                    : 'Awaiting approval'}
              </Badge>
              <button
                className="icon-button danger"
                aria-label={`Remove invitation for ${i.email}`}
                onClick={() =>
                  void action(async () => {
                    await api('/api/invites', {
                      method: 'DELETE',
                      body: JSON.stringify({ id: i.id }),
                    });
                    await refresh();
                  })
                }
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function Mailbox({
  accounts,
  demo,
  time,
  sync,
  syncing,
  onError,
  connect,
}: {
  accounts: AccountView[];
  demo: boolean;
  time: (s: string | null) => string;
  sync: (id?: string) => Promise<void>;
  syncing: boolean;
  onError: (s: string) => void;
  connect: () => void;
}) {
  const [account, setAccount] = useState(accounts[0]?.id || '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<{ messages: MailboxView[]; total: number; hasMore: boolean }>({
    messages: [],
    total: 0,
    hasMore: false,
  });
  const [opened, setOpened] = useState<{
    headers: { name: string; value: string }[];
    text: string;
    gmailId: string;
  } | null>(null);
  useEffect(() => {
    if (!account && accounts.length) setAccount(accounts[0].id);
  }, [accounts, account]);
  useEffect(() => {
    if (demo || !account) return;
    const t = setTimeout(() => {
      api<typeof items>(`/api/mailbox?accountId=${account}&q=${encodeURIComponent(q)}&page=${page}`)
        .then(setItems)
        .catch((e) => onError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [demo, account, q, page, syncing, onError]);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            Mailbox history <span className="count-pill">{items.total}</span>
          </h2>
          <p>Inbox, sent, drafts, spam and trash · metadata synced with your permission</p>
        </div>
        <button
          className="button secondary small"
          disabled={syncing || !account}
          onClick={() => void sync(account)}
        >
          <RefreshCw size={15} className={syncing ? 'spin' : ''} />
          Sync
        </button>
      </div>
      <div className="table-toolbar">
        <select
          aria-label="Mailbox"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setPage(0);
          }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search mailbox"
            placeholder="Search subject or address…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {demo ? (
        <Empty
          icon={Inbox}
          title="Your inbox belongs here"
          text="Connect Gmail to securely sync your own mailbox. No real mailbox data is used in this demo."
        />
      ) : (
        items.messages.map((m) => (
          <button
            className="mailbox-row"
            key={m.gmail_id}
            onClick={() =>
              void api<typeof opened>(`/api/mailbox/${m.gmail_id}?accountId=${account}`)
                .then(setOpened)
                .catch((e) => onError(e.message))
            }
          >
            <span className="email-avatar color-1">
              <Mail size={18} />
            </span>
            <span>
              <strong>{m.subject}</strong>
              <small>{m.sender}</small>
              <p>{m.snippet}</p>
              <span className="mailbox-labels">
                {m.labels
                  .filter((l) => !l.startsWith('CATEGORY_'))
                  .slice(0, 4)
                  .map((l) => (
                    <Badge tone="gray" key={l}>
                      {l}
                    </Badge>
                  ))}
              </span>
            </span>
            <time>{time(m.received_at)}</time>
          </button>
        ))
      )}
      {!demo && !items.messages.length && (
        <Empty
          icon={Inbox}
          title="Ready when you are"
          text="Sync your mailbox to import history. Large mailboxes import in resumable batches."
        />
      )}
      <div className="pagination">
        <button
          className="button secondary small"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary small"
          disabled={!items.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        {demo && (
          <button className="button primary small" onClick={connect}>
            Connect Gmail
          </button>
        )}
      </div>
      {opened && (
        <Modal title="Mailbox message" wide onClose={() => setOpened(null)}>
          <div className="detail-body">
            {opened.headers
              .filter((h) => ['from', 'to', 'cc', 'subject', 'date'].includes(h.name.toLowerCase()))
              .map((h, i) => (
                <p key={i}>
                  <strong>{h.name}: </strong>
                  {h.value}
                </p>
              ))}
            <div className="message-preview">{opened.text}</div>
            <p className="muted">
              Plain-text preview. Remote images are not loaded, so previewing here does not trigger
              tracking pixels.
            </p>
            <a
              className="button secondary"
              href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(accounts.find((a) => a.id === account)?.email || '')}#all/${opened.gmailId}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Gmail
              <ExternalLink size={16} />
            </a>
          </div>
        </Modal>
      )}
    </section>
  );
}
