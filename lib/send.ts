import { query } from './db';
import { id, token, origin, HttpError, rateLimit } from './security';
import { composeSchema, urlsIn, bodyHtml, bodyText, mime, escapeHtml } from './mail';
import { gmail } from './google';
import { ownedAccount } from './auth';
export async function sendMessage(userId: string, raw: unknown) {
  const input = composeSchema.parse(raw);
  let [message] = await query('SELECT * FROM messages WHERE user_id=$1 AND request_key=$2', [
    userId,
    input.requestKey,
  ]);
  if (!message) {
    const account = await ownedAccount(userId, input.accountId);
    const recipients = [
      ...input.to.map((email) => ({ email, type: 'to' })),
      ...input.cc.map((email) => ({ email, type: 'cc' })),
      ...input.bcc.map((email) => ({ email, type: 'bcc' })),
    ].filter((r, i, a) => a.findIndex((s) => s.email === r.email) === i);
    const docs = input.documentIds.length
      ? await query('SELECT id FROM documents WHERE user_id=$1 AND id=ANY($2::text[])', [
          userId,
          input.documentIds,
        ])
      : [];
    if (docs.length !== new Set(input.documentIds).size)
      throw new HttpError(404, 'Document not found');
    await rateLimit(`send:${userId}`, 100, 3600);
    const messageId = id();
    const deliveries = recipients.map((r) => ({
      id: id(),
      recipient: r.email,
      recipient_type: r.type,
      token: token(),
      rfc_id: `${id()}@${new URL(origin()).hostname}`,
    }));
    // Persist the message and every intended delivery in a single atomic statement.
    await query(
      `WITH created AS (INSERT INTO messages(id,user_id,account_id,request_key,subject,body,document_ids) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,request_key) DO NOTHING RETURNING id) INSERT INTO deliveries(id,message_id,recipient,recipient_type,token,rfc_id) SELECT d.id,created.id,d.recipient,d.recipient_type,d.token,d.rfc_id FROM created CROSS JOIN jsonb_to_recordset($8::jsonb) AS d(id text,recipient text,recipient_type text,token text,rfc_id text)`,
      [
        messageId,
        userId,
        account.id,
        input.requestKey,
        input.subject,
        input.body,
        JSON.stringify(input.documentIds),
        JSON.stringify(deliveries),
      ],
    );
    [message] = await query('SELECT * FROM messages WHERE user_id=$1 AND request_key=$2', [
      userId,
      input.requestKey,
    ]);
  }
  return processMessage(userId, message.id);
}
export async function processMessage(userId: string, messageId: string) {
  const [message] = await query('SELECT * FROM messages WHERE id=$1 AND user_id=$2', [
    messageId,
    userId,
  ]);
  if (!message) throw new HttpError(404, 'Message not found');
  const account = await ownedAccount(userId, message.account_id);
  const docs = message.document_ids.length
    ? await query('SELECT id,name FROM documents WHERE user_id=$1 AND id=ANY($2::text[])', [
        userId,
        message.document_ids,
      ])
    : [];
  await query(
    "UPDATE deliveries SET status='uncertain',error='A previous send was interrupted. Sync Gmail to reconcile before sending again.' WHERE message_id=$1 AND status='sending' AND claimed_at<now()-interval '2 minutes'",
    [messageId],
  );
  const deliveries = await query(
    "SELECT * FROM deliveries WHERE message_id=$1 AND status='pending' ORDER BY id LIMIT 3",
    [messageId],
  );
  const start = Date.now();
  for (const d of deliveries) {
    if (Date.now() - start > 30000) break;
    const claimed = await query(
      "UPDATE deliveries SET status='sending',claimed_at=now() WHERE id=$1 AND status='pending' RETURNING id",
      [d.id],
    );
    if (!claimed.length) continue;
    let attempted = false;
    try {
      if (docs.length !== new Set(message.document_ids).size)
        throw new Error('An attached document was deleted');
      const replacements = new Map<string, string>();
      for (const url of urlsIn(message.body)) {
        const t = token();
        await query('INSERT INTO links(id,delivery_id,token,destination) VALUES($1,$2,$3,$4)', [
          id(),
          d.id,
          t,
          url,
        ]);
        replacements.set(url, `${origin()}/l/${t}`);
      }
      let attachments = '';
      let plainDocs = '';
      for (const doc of docs) {
        const t = token();
        await query(
          'INSERT INTO document_shares(id,document_id,delivery_id,token) VALUES($1,$2,$3,$4)',
          [id(), doc.id, d.id, t],
        );
        const url = `${origin()}/d/${t}`;
        attachments += `<p>Document: <a href="${url}">${escapeHtml(doc.name)}</a></p>`;
        plainDocs += `\n${doc.name}: ${url}`;
      }
      const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#202b36">${bodyHtml(message.body, replacements)}${attachments}<p style="font-size:11px;color:#667085">Sent with MailTrack. This email includes open and link activity tracking.</p><img src="${origin()}/t/${d.token}.gif" width="1" height="1" alt="" /></div>`;
      const text =
        bodyText(message.body, replacements) +
        plainDocs +
        '\n\nSent with MailTrack. Link activity is tracked.';
      const raw = mime({
        from: account.email,
        to: d.recipient,
        subject: message.subject,
        text,
        html,
        messageId: d.rfc_id,
      });
      attempted = true;
      const sent = await gmail<{ id: string; threadId: string }>(account, 'messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw }),
      });
      await query(
        "UPDATE deliveries SET status='sent',gmail_id=$1,thread_id=$2,sent_at=now() WHERE id=$3",
        [sent.id, sent.threadId, d.id],
      );
    } catch {
      await query('UPDATE deliveries SET status=$1,error=$2 WHERE id=$3', [
        attempted ? 'uncertain' : 'failed',
        attempted
          ? 'Delivery could not be confirmed. Sync Gmail and check Sent before sending again.'
          : 'Message preparation failed (a document may have been deleted). No send was attempted.',
        d.id,
      ]);
    }
  }
  const all = await query(
    'SELECT id,recipient,status,error FROM deliveries WHERE message_id=$1 ORDER BY id',
    [messageId],
  );
  return { id: messageId, deliveries: all, more: all.some((d) => d.status === 'pending') };
}
