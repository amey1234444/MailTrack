import { simpleParser } from 'mailparser';
import { imapClient, locator } from './mailbox';
import { query } from './db';
import { unseal } from './security';
import { saveMailboxMessage } from './sync';
import type { Account } from './types';

// Each request imports at most 25 headers from one folder. Subsequent sweeps refresh
// flags and remove deleted messages without keeping an IMAP connection alive on Vercel.
export async function syncImap(
  account: Account,
): Promise<{ more: boolean; processed: number; busy?: boolean }> {
  const c = imapClient(account.email, unseal(account.refresh_token));
  try {
    await c.connect();
    const listed = (await c.list()).filter((f) => !f.flags.has('\\Noselect'));
    const all = listed.find((f) => f.specialUse === '\\All');
    const folders = (
      all
        ? listed.filter(
            (f) => f.path === all.path || ['\\Junk', '\\Trash'].includes(f.specialUse || ''),
          )
        : listed
    ).sort((a, b) => a.path.localeCompare(b.path));
    await query(
      'DELETE FROM mailbox_messages WHERE account_id=$1 AND source_folder IS NOT NULL AND NOT(source_folder=ANY($2::text[]))',
      [account.id, folders.map((f) => f.path)],
    );
    const cursor = account.imap_cursor || { folder: 0, uid: 0, validity: '' };
    const folderIndex = cursor.folder < folders.length ? cursor.folder : 0;
    const folder = folders[folderIndex];
    if (!folder) return { more: false, processed: 0 };
    const box = await c.mailboxOpen(folder.path, { readOnly: true });
    const validity = String(box.uidValidity);
    const last = validity === cursor.validity ? cursor.uid : 0;
    const uids = ((await c.search({ all: true }, { uid: true })) || []).sort((a, b) => a - b);
    await query(
      'DELETE FROM mailbox_messages WHERE account_id=$1 AND source_folder=$2 AND (source_validity<>$3 OR NOT(source_uid=ANY($4::bigint[])))',
      [account.id, folder.path, validity, uids],
    );
    const pending = uids.filter((uid) => uid > last);
    const batch = pending.slice(0, 25);
    if (batch.length) {
      for await (const m of c.fetch(
        batch,
        {
          headers: ['Subject', 'From', 'To', 'Cc', 'Message-ID', 'In-Reply-To', 'References'],
          internalDate: true,
          threadId: true,
          labels: true,
          flags: true,
        },
        { uid: true },
      )) {
        const p = await simpleParser(m.headers || Buffer.alloc(0));
        const decoded = new Map<string, string>([
          ['subject', p.subject || ''],
          ['from', p.from?.text || ''],
          ['to', (Array.isArray(p.to) ? p.to : p.to ? [p.to] : []).map((a) => a.text).join(', ')],
          ['cc', (Array.isArray(p.cc) ? p.cc : p.cc ? [p.cc] : []).map((a) => a.text).join(', ')],
        ]);
        const names: Record<string, string> = {
          '\\Sent': 'SENT',
          '\\Inbox': 'INBOX',
          '\\Draft': 'DRAFT',
          '\\Drafts': 'DRAFT',
          '\\Junk': 'SPAM',
          '\\Spam': 'SPAM',
          '\\Trash': 'TRASH',
        };
        const labels = [...(m.labels || [])].map((l) => names[l] || l);
        if (folder.specialUse && names[folder.specialUse]) labels.push(names[folder.specialUse]);
        if (!m.flags?.has('\\Seen')) labels.push('UNREAD');
        const mid = locator(folder.path, validity, m.uid);
        await saveMailboxMessage(account, {
          id: mid,
          threadId: m.threadId || mid,
          labelIds: [...new Set(labels)],
          internalDate: String(new Date(m.internalDate || Date.now()).getTime()),
          payload: {
            headers: p.headerLines.map((h) => ({
              name: h.key,
              value:
                decoded.get(h.key) ||
                h.line
                  .slice(h.line.indexOf(':') + 1)
                  .trim()
                  .replace(/\r?\n\s+/g, ' '),
            })),
          },
        });
        await query(
          'UPDATE mailbox_messages SET source_folder=$1,source_validity=$2,source_uid=$3 WHERE account_id=$4 AND gmail_id=$5',
          [folder.path, validity, m.uid, account.id, mid],
        );
      }
    }
    const moreInFolder = pending.length > batch.length;
    const more = moreInFolder || folderIndex + 1 < folders.length;
    const next = moreInFolder
      ? { folder: folderIndex, uid: batch[batch.length - 1], validity }
      : { folder: more ? folderIndex + 1 : 0, uid: 0, validity: '' };
    await query('UPDATE accounts SET imap_cursor=$1,sync_complete=$2,synced_at=now() WHERE id=$3', [
      JSON.stringify(next),
      account.sync_complete || !more,
      account.id,
    ]);
    return { more, processed: batch.length };
  } finally {
    c.close();
  }
}
