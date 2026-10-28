'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Eye, Download, Clock } from 'lucide-react';
interface Analytics {
  document: { name: string };
  recipients: {
    recipient: string;
    views: number;
    downloads: number;
    seconds: number;
    last_activity: string | null;
  }[];
  pages: { page: number; sessions: number; seconds: number }[];
}
export default function DocumentAnalytics({ id, close }: { id: string; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
    void fetch(`/api/documents/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const total = (key: 'views' | 'downloads' | 'seconds') =>
    data?.recipients.reduce((a, r) => a + r[key], 0) || 0;
  return (
    <dialog ref={ref} className="modal wide" onCancel={close}>
      <div className="modal-head">
        <h2>Document analytics</h2>
        <button className="icon-button" aria-label="Close analytics" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <div className="detail-body">
        {error ? (
          <div className="alert error">{error}</div>
        ) : !data ? (
          <p>Loading document activity…</p>
        ) : (
          <>
            <h3>{data.document.name}</h3>
            <p>
              Page activity and visible-tab time are technical signals, not proof of attentive
              reading.
            </p>
            <div className="document-stats">
              <span>
                <Eye size={18} />
                <strong>{total('views')}</strong> views
              </span>
              <span>
                <Download size={18} />
                <strong>{total('downloads')}</strong> downloads
              </span>
              <span>
                <Clock size={18} />
                <strong>{Math.round(total('seconds') / 60)}</strong> visible minutes
              </span>
            </div>
            <h3>Intended recipients</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>RECIPIENT</th>
                    <th>VIEWS</th>
                    <th>DOWNLOADS</th>
                    <th>VISIBLE TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((r) => (
                    <tr key={r.recipient}>
                      <td>{r.recipient}</td>
                      <td>{r.views}</td>
                      <td>{r.downloads}</td>
                      <td>{r.seconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Page by page</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PAGE</th>
                    <th>VIEWER SESSIONS</th>
                    <th>VISIBLE TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.map((p) => (
                    <tr key={p.page}>
                      <td>{p.page}</td>
                      <td>{p.sessions}</td>
                      <td>{p.seconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.pages.length && (
              <p className="muted">
                No page activity recorded yet. Share this PDF through a tracked email.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
