import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  cookies: vi.fn(),
  gmail: vi.fn(),
  revoke: vi.fn(),
  exchange: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ query: mocks.query }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@/lib/google', async () => ({
  ...(await vi.importActual('@/lib/google')),
  gmail: mocks.gmail,
  revoke: mocks.revoke,
  exchange: mocks.exchange,
}));
import { query } from '@/lib/db';
import { seal, hash, id, token } from '@/lib/security';
import { ownedAccount, currentUser } from '@/lib/auth';
import { sendMessage, processMessage } from '@/lib/send';
import { syncMailbox, saveMailboxMessage } from '@/lib/sync';
import { sharedDocument } from '@/lib/documents';
import { GET as pixel, HEAD as pixelHead } from '@/app/t/[token]/route';
import { GET as click } from '@/app/l/[token]/route';
import { GET as dashboard } from '@/app/api/dashboard/route';
import { GET as detail } from '@/app/api/messages/[id]/route';
import { GET as exportCsv } from '@/app/api/export/route';
import { GET as oauthStart } from '@/app/api/auth/google/route';
import { GET as oauthCallback } from '@/app/api/auth/callback/route';
import { POST as pdfEvent } from '@/app/api/public/documents/[token]/events/route';
import { DELETE as disconnect } from '@/app/api/accounts/[id]/route';
import type { Account } from '@/lib/types';
let db: PGlite;
const jar = new Map<string, string>();
const compose = {
  accountId: 'account-a',
  requestKey: 'unique-request-12345',
  to: ['recipient@example.com'],
  cc: [],
  bcc: [],
  subject: 'Project proposal',
  body: 'Hello! Details: https://example.com/proposal',
  documentIds: [],
};
const req = (path: string, method = 'GET', data?: unknown) =>
  new Request(`https://mail.example.com${path}`, {
    method,
    headers: { origin: 'https://mail.example.com', 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync('db/schema.sql', 'utf8'));
  mocks.query.mockImplementation(async (sql: string, p: unknown[] = []) => {
    return (await db.query(sql, p)).rows;
  });
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec('TRUNCATE users,rate_limits CASCADE');
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
  process.env.APP_URL = 'https://mail.example.com';
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'test';
  jar.clear();
  jar.set('mt_session', 'session-a');
  mocks.cookies.mockResolvedValue({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  });
  mocks.gmail.mockReset();
  mocks.revoke.mockReset();
  mocks.revoke.mockResolvedValue(undefined);
  mocks.exchange.mockReset();
  vi.unstubAllGlobals();
  await query(
    "INSERT INTO users(id,google_sub,email,name) VALUES('user-a','google-a','owner@example.com','Owner'),('user-b','google-b','other@example.com','Other')",
  );
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,'user-a',now()+interval '1 day')",
    [hash('session-a')],
  );
  for (const suffix of ['a', 'b'])
    await query(
      'INSERT INTO accounts(id,user_id,google_sub,email,access_token,refresh_token,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        `account-${suffix}`,
        `user-${suffix}`,
        `google-${suffix}`,
        `${suffix}@example.com`,
        seal('access'),
        seal('refresh'),
        new Date(Date.now() + 3600000),
      ],
    );
});
async function account() {
  return (await query<Account>("SELECT * FROM accounts WHERE id='account-a'"))[0];
}
async function sent() {
  mocks.gmail.mockResolvedValue({ id: 'gmail-sent', threadId: 'thread-1' });
  return sendMessage('user-a', compose);
}
it('enforces user ownership and expired sessions', async () => {
  expect((await currentUser())?.id).toBe('user-a');
  await expect(ownedAccount('user-a', 'account-b')).rejects.toMatchObject({ status: 404 });
  await query("UPDATE sessions SET expires_at=now()-interval '1 day'");
  expect(await currentUser()).toBeNull();
});
it('sends unique copies, persists tracking links, and deduplicates a repeated request', async () => {
  mocks.gmail.mockImplementation(async () => ({ id: id(), threadId: id() }));
  const input = {
    ...compose,
    to: ['one@example.com', 'two@example.com'],
    bcc: ['one@example.com', 'hidden@example.com'],
  };
  const result = await sendMessage('user-a', input);
  expect(result.deliveries).toHaveLength(3);
  expect(mocks.gmail).toHaveBeenCalledTimes(3);
  const d = await query('SELECT * FROM deliveries');
  expect(new Set(d.map((r) => r.token)).size).toBe(3);
  expect(await query('SELECT * FROM links')).toHaveLength(3);
  for (const call of mocks.gmail.mock.calls) {
    const raw = Buffer.from(JSON.parse(call[2].body).raw, 'base64url').toString();
    expect(raw).not.toContain('Bcc:');
    expect((raw.match(/^To:/gm) || []).length).toBe(1);
  }
  await sendMessage('user-a', input);
  expect(mocks.gmail).toHaveBeenCalledTimes(3);
  expect(await query('SELECT * FROM messages')).toHaveLength(1);
});
it('resumes batches and rejects another user continuing a send', async () => {
  mocks.gmail.mockResolvedValue({ id: 'sent', threadId: 't' });
  const first = await sendMessage('user-a', {
    ...compose,
    to: Array.from({ length: 5 }, (_, i) => `person${i}@example.com`),
  });
  expect(first.more).toBe(true);
  expect(first.deliveries.filter((d) => d.status === 'pending')).toHaveLength(2);
  await expect(processMessage('user-b', first.id)).rejects.toMatchObject({ status: 404 });
  const second = await processMessage('user-a', first.id);
  expect(second.more).toBe(false);
  expect(second.deliveries.filter((d) => d.status === 'sent')).toHaveLength(5);
  expect(mocks.gmail).toHaveBeenCalledTimes(5);
});
it('does not retry an uncertain network send', async () => {
  mocks.gmail.mockRejectedValue(new Error('timeout'));
  const result = await sendMessage('user-a', compose);
  expect(result.deliveries[0].status).toBe('uncertain');
  await sendMessage('user-a', compose);
  expect(mocks.gmail).toHaveBeenCalledTimes(1);
});
it('reconciles uncertain sends from Gmail Message-ID during sync', async () => {
  mocks.gmail.mockRejectedValue(new Error('timeout'));
  await sendMessage('user-a', compose);
  const [d] = await query('SELECT * FROM deliveries');
  await saveMailboxMessage(await account(), {
    id: 'recovered',
    threadId: 'thread',
    labelIds: ['SENT'],
    internalDate: String(Date.now()),
    payload: { headers: [{ name: 'Message-ID', value: `<${d.rfc_id}>` }] },
  });
  expect((await query('SELECT * FROM deliveries'))[0].status).toBe('sent');
});
it('records pixel requests without caching and never records HEAD probes', async () => {
  await sent();
  const [d] = await query('SELECT * FROM deliveries');
  const context = { params: Promise.resolve({ token: `${d.token}.gif` }) };
  const a = await pixel(req(`/t/${d.token}.gif`), context);
  await pixel(req(`/t/${d.token}.gif`), context);
  await pixelHead();
  expect(a.headers.get('Content-Type')).toBe('image/gif');
  expect(a.headers.get('Cache-Control')).toContain('no-store');
  expect(await query("SELECT * FROM events WHERE kind='open'")).toHaveLength(2);
});
it('uses only stored destinations and records link clicks', async () => {
  await sent();
  const [l] = await query('SELECT * FROM links');
  const r = await click(req(`/l/${l.token}?url=https://evil.example`), {
    params: Promise.resolve({ token: l.token }),
  });
  expect(r.status).toBe(302);
  expect(r.headers.get('location')).toBe('https://example.com/proposal');
  expect(await query("SELECT * FROM events WHERE kind='click'")).toHaveLength(1);
});
it('matches reply headers once and ignores unrelated messages', async () => {
  await sent();
  const [d] = await query('SELECT * FROM deliveries');
  const m = {
    id: 'reply-1',
    threadId: 'thread',
    labelIds: ['INBOX'],
    internalDate: String(Date.now()),
    payload: {
      headers: [
        { name: 'In-Reply-To', value: `<${d.rfc_id}>` },
        { name: 'From', value: 'recipient@example.com' },
        { name: 'Subject', value: 'Re: Proposal' },
      ],
    },
  };
  await saveMailboxMessage(await account(), m);
  await saveMailboxMessage(await account(), m);
  await saveMailboxMessage(await account(), { ...m, id: 'unrelated', payload: { headers: [] } });
  expect(await query("SELECT * FROM events WHERE kind='reply'")).toHaveLength(1);
  expect((await query('SELECT * FROM deliveries'))[0].replied_at).not.toBeNull();
});
it('resumes full import and then applies history changes', async () => {
  mocks.gmail.mockImplementation(async (_a: Account, path: string) => {
    if (path === 'profile') return { historyId: '100' };
    if (path.startsWith('messages?')) return { messages: [{ id: 'm1' }], nextPageToken: undefined };
    if (path.startsWith('messages/m1'))
      return {
        id: 'm1',
        threadId: 't1',
        labelIds: ['INBOX'],
        payload: { headers: [{ name: 'Subject', value: 'Original' }] },
      };
    if (path.startsWith('history?'))
      return { historyId: '110', history: [{ messagesDeleted: [{ message: { id: 'm1' } }] }] };
    throw new Error(path);
  });
  const first = await syncMailbox(await account());
  expect(first.processed).toBe(1);
  expect((await account()).sync_complete).toBe(true);
  expect((await account()).history_id).toBe('100');
  await syncMailbox(await account());
  expect(await query('SELECT * FROM mailbox_messages')).toHaveLength(0);
  expect((await account()).history_id).toBe('110');
});
it('resets expired history without losing the ability to resume', async () => {
  await query("UPDATE accounts SET sync_complete=true,history_id='100' WHERE id='account-a'");
  const { HttpError } = await import('@/lib/security');
  mocks.gmail.mockRejectedValue(new HttpError(404, 'Expired'));
  expect((await syncMailbox(await account())).more).toBe(true);
  expect((await account()).history_id).toBeNull();
  expect((await account()).sync_complete).toBe(false);
});
it('rejects duplicate sync workers', async () => {
  await query("UPDATE accounts SET sync_lock_until=now()+interval '1 minute' WHERE id='account-a'");
  expect((await syncMailbox(await account())).busy).toBe(true);
  expect(mocks.gmail).not.toHaveBeenCalled();
});
it('limits analytics to the signed-in workspace and exports valid CSV', async () => {
  const a = await sent();
  const [d] = await query('SELECT * FROM deliveries');
  await pixel(req(`/t/${d.token}`), { params: Promise.resolve({ token: d.token }) });
  const response = await dashboard(req('/api/dashboard'));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.stats.opens).toBe(1);
  expect(data.stats.sent).toBe(1);
  expect(data.messages[0].id).toBe(a.id);
  const csv = await (await exportCsv(req('/api/export'))).text();
  expect(csv).toContain('recipient@example.com');
  expect(csv).toContain('open');
  await query("UPDATE sessions SET user_id='user-b'");
  const other = await dashboard(req('/api/dashboard'));
  expect((await other.json()).stats.sent).toBe(0);
  expect((await detail(req(`/api/messages/${a.id}`))).status).toBe(404);
});
it('validates and deduplicates PDF events, and revokes shares on document deletion', async () => {
  await query(
    "INSERT INTO documents(id,user_id,name,data,pages) VALUES('doc','user-a','proposal.pdf',$1,3)",
    [Buffer.from('%PDF-test')],
  );
  mocks.gmail.mockResolvedValue({ id: 'gmail', threadId: 'thread' });
  await sendMessage('user-a', { ...compose, documentIds: ['doc'] });
  const [share] = await query('SELECT * FROM document_shares');
  const data = {
    kind: 'page_view',
    page: 2,
    duration: 10,
    eventId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
  };
  expect(
    (await pdfEvent(req(`/api/public/documents/${share.token}/events`, 'POST', data))).status,
  ).toBe(200);
  await pdfEvent(req(`/api/public/documents/${share.token}/events`, 'POST', data));
  expect(await query("SELECT * FROM events WHERE kind='page_view'")).toHaveLength(1);
  expect(
    (
      await pdfEvent(
        req(`/api/public/documents/${share.token}/events`, 'POST', { ...data, page: 4 }),
      )
    ).status,
  ).toBe(400);
  await query("DELETE FROM documents WHERE id='doc'");
  await expect(sharedDocument(share.token)).rejects.toMatchObject({ status: 404 });
});
it('binds OAuth approval to the invited email and never signs in as the workspace owner', async () => {
  const t = token();
  await query(
    "INSERT INTO invitations(id,user_id,email,token_hash,expires_at) VALUES('invite','user-a','invited@example.com',$1,now()+interval '1 day')",
    [hash(t)],
  );
  const start = await oauthStart(req(`/api/auth/google?invite=${t}`));
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get('location')!);
  expect(location.searchParams.get('login_hint')).toBe('invited@example.com');
  expect(location.searchParams.get('code_challenge')).toBeTruthy();
  mocks.exchange.mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    scope:
      'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ sub: 'invited-google', email: 'wrong@example.com', email_verified: true }),
      ),
  );
  const rejected = await oauthCallback(
    req(
      `/api/auth/callback?state=${encodeURIComponent(location.searchParams.get('state')!)}&code=test`,
    ),
  );
  expect(rejected.headers.get('location')).toContain('error=');
  expect((await query("SELECT * FROM invitations WHERE id='invite'"))[0].used_at).toBeNull();
  const again = await oauthStart(req(`/api/auth/google?invite=${t}`));
  const state = new URL(again.headers.get('location')!).searchParams.get('state')!;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        sub: 'invited-google',
        email: 'invited@example.com',
        email_verified: true,
      }),
    ),
  );
  jar.delete('mt_session');
  const approved = await oauthCallback(
    req(`/api/auth/callback?state=${encodeURIComponent(state)}&code=test`),
  );
  expect(approved.headers.get('location')).toBe('https://mail.example.com/approved');
  expect(jar.has('mt_session')).toBe(false);
  expect(
    await query("SELECT * FROM accounts WHERE user_id='user-a' AND email='invited@example.com'"),
  ).toHaveLength(1);
  expect((await oauthStart(req(`/api/auth/google?invite=${t}`))).status).toBe(400);
});
it('rejects OAuth state from another browser', async () => {
  const start = await oauthStart(req('/api/auth/google'));
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
  jar.set('mt_oauth', 'wrong');
  const result = await oauthCallback(
    req(`/api/auth/callback?state=${encodeURIComponent(state)}&code=x`),
  );
  expect(result.headers.get('location')).toContain('error=');
  expect(mocks.exchange).not.toHaveBeenCalled();
});
it('disconnects only an owned mailbox and cascades its data', async () => {
  await sent();
  expect((await disconnect(req('/api/accounts/account-b', 'DELETE'))).status).toBe(404);
  expect(mocks.revoke).not.toHaveBeenCalled();
  expect((await disconnect(req('/api/accounts/account-a', 'DELETE'))).status).toBe(200);
  expect(mocks.revoke).toHaveBeenCalledTimes(1);
  expect(await query('SELECT * FROM messages')).toHaveLength(0);
  expect(await query('SELECT * FROM links')).toHaveLength(0);
  expect(await query("SELECT * FROM accounts WHERE id='account-b'")).toHaveLength(1);
});
it('aggregates document analytics without exposing another owner’s document', async () => {
  const { GET } = await import('@/app/api/documents/[id]/route');
  await query(
    "INSERT INTO documents(id,user_id,name,data,pages) VALUES('doc','user-a','proposal.pdf',$1,3)",
    [Buffer.from('%PDF-test')],
  );
  mocks.gmail.mockResolvedValue({ id: 'gmail', threadId: 'thread' });
  await sendMessage('user-a', { ...compose, documentIds: ['doc'] });
  const [share] = await query('SELECT * FROM document_shares');
  await pdfEvent(
    req(`/api/public/documents/${share.token}/events`, 'POST', {
      kind: 'page_view',
      page: 2,
      duration: 10,
      eventId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
    }),
  );
  const response = await GET(req('/api/documents/doc'));
  expect(response.status).toBe(200);
  const report = await response.json();
  expect(report.pages[0].seconds).toBe(10);
  expect(report.recipients[0].recipient).toBe('recipient@example.com');
  await query("UPDATE sessions SET user_id='user-b'");
  expect((await GET(req('/api/documents/doc'))).status).toBe(404);
});
it('validates real PDFs and rejects non-PDF uploads', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const { POST } = await import('@/app/api/documents/route');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const form = new FormData();
  form.set('file', new File([new Uint8Array(bytes)], 'test.pdf', { type: 'application/pdf' }));
  const result = await POST(
    new Request('https://mail.example.com/api/documents', {
      method: 'POST',
      headers: { origin: 'https://mail.example.com' },
      body: form,
    }),
  );
  expect(result.status).toBe(200);
  expect((await query('SELECT pages FROM documents'))[0].pages).toBe(1);
  const bad = new FormData();
  bad.set('file', new File(['<script>alert(1)</script>'], 'fake.pdf', { type: 'application/pdf' }));
  expect(
    (
      await POST(
        new Request('https://mail.example.com/api/documents', {
          method: 'POST',
          headers: { origin: 'https://mail.example.com' },
          body: bad,
        }),
      )
    ).status,
  ).toBe(400);
});
