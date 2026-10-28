import { query } from './db';
import { gmail } from './google';
import { id, HttpError } from './security';
import type { Account, GmailMessage } from './types';
export function header(m: GmailMessage, name: string) {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}
export async function saveMailboxMessage(account: Account, m: GmailMessage) {
  const headers = m.payload?.headers || [];
  await query(
    `INSERT INTO mailbox_messages(account_id,gmail_id,thread_id,subject,sender,recipients,snippet,labels,headers,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(account_id,gmail_id) DO UPDATE SET labels=EXCLUDED.labels,headers=EXCLUDED.headers,snippet=EXCLUDED.snippet`,
    [
      account.id,
      m.id,
      m.threadId,
      header(m, 'Subject') || '(no subject)',
      header(m, 'From'),
      [header(m, 'To'), header(m, 'Cc')].filter(Boolean).join(', '),
      m.snippet || '',
      JSON.stringify(m.labelIds || []),
      JSON.stringify(headers),
      new Date(Number(m.internalDate) || Date.now()),
    ],
  );
  const outboundId = header(m, 'Message-ID').replace(/^<|>$/g, '');
  if ((m.labelIds || []).includes('SENT')) {
    await query(
      `UPDATE deliveries SET status='sent',gmail_id=$1,thread_id=$2,sent_at=COALESCE(sent_at,$3),error=NULL WHERE rfc_id=$4 AND message_id IN(SELECT id FROM messages WHERE account_id=$5)`,
      [m.id, m.threadId, new Date(Number(m.internalDate) || Date.now()), outboundId, account.id],
    );
    return;
  }
  const references =
    `${header(m, 'In-Reply-To')} ${header(m, 'References')}`
      .match(/<([^>]+)>/g)
      ?.map((s) => s.slice(1, -1)) || [];
  if (!references.length) return;
  const matches = await query(
    `SELECT d.id FROM deliveries d JOIN messages m ON m.id=d.message_id WHERE m.account_id=$1 AND d.rfc_id=ANY($2::text[])`,
    [account.id, references],
  );
  for (const d of matches) {
    const at = new Date(Number(m.internalDate) || Date.now());
    await query('UPDATE deliveries SET replied_at=COALESCE(replied_at,$1) WHERE id=$2', [at, d.id]);
    await query(
      `INSERT INTO events(id,delivery_id,kind,occurred_at,detail,dedupe_key) VALUES($1,$2,'reply',$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        id(),
        d.id,
        at,
        JSON.stringify({ gmailId: m.id, from: header(m, 'From') }),
        `reply:${account.id}:${m.id}:${d.id}`,
      ],
    );
  }
}
async function fetchMessage(account: Account, messageId: string) {
  try {
    const m = await gmail<GmailMessage>(
      account,
      `messages/${encodeURIComponent(messageId)}?format=metadata`,
    );
    await saveMailboxMessage(account, m);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404)
      await query('DELETE FROM mailbox_messages WHERE account_id=$1 AND gmail_id=$2', [
        account.id,
        messageId,
      ]);
    else throw e;
  }
}
export async function syncMailbox(account: Account) {
  const claimed = await query(
    "UPDATE accounts SET sync_lock_until=now()+interval '2 minutes' WHERE id=$1 AND (sync_lock_until IS NULL OR sync_lock_until<now()) RETURNING id",
    [account.id],
  );
  if (!claimed.length) return { busy: true, more: true, processed: 0 };
  try {
    if (!account.sync_complete) {
      if (!account.history_id) {
        const profile = await gmail<{ historyId: string }>(account, 'profile');
        account.history_id = profile.historyId;
        await query('UPDATE accounts SET history_id=$1 WHERE id=$2', [
          profile.historyId,
          account.id,
        ]);
      }
      const p = new URLSearchParams({ maxResults: '25', includeSpamTrash: 'true' });
      if (account.page_token) p.set('pageToken', account.page_token);
      let list: { messages?: { id: string }[]; nextPageToken?: string };
      try {
        list = await gmail(account, `messages?${p}`);
      } catch (e) {
        if (e instanceof HttpError && account.page_token) {
          await query('UPDATE accounts SET page_token=NULL,history_id=NULL WHERE id=$1', [
            account.id,
          ]);
        }
        throw e;
      }
      for (let n = 0; n < (list.messages?.length || 0); n += 5)
        await Promise.all(list.messages!.slice(n, n + 5).map((m) => fetchMessage(account, m.id)));
      await query(
        'UPDATE accounts SET page_token=$1,sync_complete=$2,synced_at=now() WHERE id=$3',
        [list.nextPageToken || null, !list.nextPageToken, account.id],
      );
      return { more: true, initial: !!list.nextPageToken, processed: list.messages?.length || 0 };
    }
    const p = new URLSearchParams({ startHistoryId: account.history_id!, maxResults: '25' });
    if (account.history_page) p.set('pageToken', account.history_page);
    type History = {
      history?: { messages?: { id: string }[]; messagesDeleted?: { message: { id: string } }[] }[];
      nextPageToken?: string;
      historyId: string;
    };
    let history: History;
    try {
      history = await gmail(account, `history?${p}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) {
        await query(
          'UPDATE accounts SET sync_complete=false,history_id=NULL,page_token=NULL,history_page=NULL WHERE id=$1',
          [account.id],
        );
        return { more: true, processed: 0, reset: true };
      }
      throw e;
    }
    const ids = [
      ...new Set(history.history?.flatMap((h) => h.messages?.map((m) => m.id) || []) || []),
    ];
    for (let n = 0; n < ids.length; n += 5)
      await Promise.all(ids.slice(n, n + 5).map((mid) => fetchMessage(account, mid)));
    for (const h of history.history || [])
      for (const d of h.messagesDeleted || [])
        await query('DELETE FROM mailbox_messages WHERE account_id=$1 AND gmail_id=$2', [
          account.id,
          d.message.id,
        ]);
    await query('UPDATE accounts SET history_page=$1,history_id=$2,synced_at=now() WHERE id=$3', [
      history.nextPageToken || null,
      history.nextPageToken ? account.history_id : history.historyId,
      account.id,
    ]);
    return { more: !!history.nextPageToken, processed: ids.length };
  } finally {
    await query('UPDATE accounts SET sync_lock_until=NULL WHERE id=$1', [account.id]);
  }
}
