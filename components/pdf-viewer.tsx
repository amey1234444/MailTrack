'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
export default function PdfViewer({
  token,
  name,
  pages,
}: {
  token: string;
  name: string;
  pages: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendered, setRendered] = useState(0);
  const session = useRef('');
  useEffect(() => {
    session.current = crypto.randomUUID();
    let canceled = false;
    let loaded: PDFDocumentProxy | undefined;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        loadingTask = pdfjs.getDocument({
          url: `/api/public/documents/${token}/file`,
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
        });
        loaded = await loadingTask.promise;
        if (!canceled) {
          setDoc(loaded);
          void fetch(`/api/public/documents/${token}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'document_view',
              eventId: crypto.randomUUID(),
              sessionId: session.current,
            }),
          }).catch(() => {});
        } else await loadingTask.destroy();
      } catch {
        if (!canceled) setError('The PDF could not be loaded. The link may have been revoked.');
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
      void loadingTask?.destroy();
    };
  }, [token]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let canceled = false;
    let task: { cancel: () => void } | undefined;
    setRendered(0);
    async function render() {
      try {
        const pdfPage = await doc!.getPage(page);
        if (canceled) return;
        const width = Math.min(900, window.innerWidth - 70);
        const scale = width / pdfPage.getViewport({ scale: 1 }).width;
        const viewport = pdfPage.getViewport({
          scale: scale * Math.min(window.devicePixelRatio || 1, 2),
        });
        const c = canvas.current!;
        c.width = viewport.width;
        c.height = viewport.height;
        c.style.width = `${width}px`;
        c.style.height = `${viewport.height / Math.min(window.devicePixelRatio || 1, 2)}px`;
        const renderTask = pdfPage.render({ canvas: c, viewport });
        task = renderTask;
        await renderTask.promise;
        if (!canceled) setRendered(page);
      } catch (e) {
        if (!canceled && (e as Error).name !== 'RenderingCancelledException')
          setError('This page could not be rendered.');
      }
    }
    void render();
    return () => {
      canceled = true;
      task?.cancel();
    };
  }, [doc, page]);
  useEffect(() => {
    if (!rendered) return;
    void fetch(`/api/public/documents/${token}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'page_view',
        page: rendered,
        duration: 0,
        eventId: crypto.randomUUID(),
        sessionId: session.current,
      }),
    }).catch(() => {});
    let last = performance.now();
    let duration = 0;
    const send = () => {
      const now = performance.now();
      if (document.visibilityState === 'visible') duration += Math.min((now - last) / 1000, 15);
      last = now;
      if (duration < 0.5) return;
      const body = JSON.stringify({
        kind: 'page_view',
        page: rendered,
        duration: Math.min(30, Math.round(duration)),
        eventId: crypto.randomUUID(),
        sessionId: session.current,
      });
      duration = 0;
      void fetch(`/api/public/documents/${token}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === 'hidden') {
        const now = performance.now();
        duration += Math.min((now - last) / 1000, 15);
        last = now;
        send();
      } else last = performance.now();
    };
    const timer = setInterval(send, 10000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pagehide', send);
    return () => {
      send();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pagehide', send);
    };
  }, [rendered, token]);
  return (
    <main className="pdf-shell">
      <header className="pdf-toolbar">
        <div>
          <h1>
            <FileText size={20} /> {name}
          </h1>
          <p>Shared securely through MailTrack · link holders can access this document</p>
        </div>
        <div className="pdf-pagination">
          <button
            className="button secondary small"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            className="button secondary small"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={17} />
          </button>
          <a
            className="button primary small"
            href={`/api/public/documents/${token}/file?download=1`}
          >
            <Download size={16} />
            Download
          </a>
        </div>
      </header>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="pdf-stage">
        {loading ? (
          <div className="pdf-loading">
            <LoaderCircle size={30} className="spin" /> Loading document…
          </div>
        ) : (
          <canvas ref={canvas} aria-label={`Page ${page} of ${name}`} />
        )}
      </div>
      <p className="pdf-privacy">
        <ShieldCheck size={15} /> This viewer records document opens, page activity, visible-tab
        duration and downloads for the sender.
        <br />
        These signals do not prove attentive reading. <a href="/privacy">Learn more</a>
      </p>
    </main>
  );
}
