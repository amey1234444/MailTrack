import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { unseal, HttpError } from './security';
import type { Account, GmailMessage } from './types';

export function imapClient(email: string, password: string) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    disableAutoIdle: true,
  });
  client.on('error', () => {
    /* Operations surface sanitized errors; never log credentials. */
  });
  return client;
}
export function smtpClient(email: string, password: string) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    logger: false,
    debug: false,
  });
}
export async function verifyMailbox(email: string, password: string) {
  const client = imapClient(email, password);
  const smtp = smtpClient(email, password);
  try {
    await client.connect();
    await smtp.verify();
  } catch {
    throw new HttpError(
      400,
      'Gmail could not verify IMAP and SMTP access. Check your email and App Password, 2-Step Verification, and account policies.',
    );
  } finally {
    client.close();
    smtp.close();
  }
}
export function locator(path: string, validity: string, uid: number) {
  return Buffer.from(JSON.stringify([path, validity, uid])).toString('base64url');
}
export function parseLocator(value: string): [string, string, number] {
  try {
    const x = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (
      !Array.isArray(x) ||
      x.length !== 3 ||
      typeof x[0] !== 'string' ||
      typeof x[1] !== 'string' ||
      !Number.isSafeInteger(x[2]) ||
      x[2] < 1
    )
      throw new Error();
    return [x[0], x[1], x[2]];
  } catch {
    throw new HttpError(400, 'Invalid mailbox message identifier');
  }
}
export async function smtpSend(account: Account, raw: string) {
  const source = Buffer.from(raw, 'base64url');
  const parsed = await simpleParser(source);
  const recipients = [parsed.to, parsed.cc, parsed.bcc].flatMap((v) =>
    (Array.isArray(v) ? v : v ? [v] : []).flatMap((a) =>
      a.value.map((v) => v.address).filter((v): v is string => !!v),
    ),
  );
  if (!recipients.length) throw new HttpError(400, 'A recipient is required');
  const smtp = smtpClient(account.email, unseal(account.refresh_token));
  try {
    const result = await smtp.sendMail({
      envelope: { from: account.email, to: recipients },
      raw: source,
    });
    if (result.rejected.length || !result.accepted.length) throw new Error('Delivery rejected');
    // SMTP acceptance is not a Gmail message ID. Sync reconciles the RFC Message-ID later.
    return { id: null, threadId: null };
  } finally {
    smtp.close();
  }
}
export async function imapMessage(account: Account, messageId: string): Promise<GmailMessage> {
  const [path, validity, uid] = parseLocator(messageId);
  const c = imapClient(account.email, unseal(account.refresh_token));
  try {
    await c.connect();
    const box = await c.mailboxOpen(path, { readOnly: true });
    if (String(box.uidValidity) !== validity)
      throw new HttpError(404, 'Message identifier expired; sync your mailbox again');
    const meta = await c.fetchOne(String(uid), { size: true }, { uid: true });
    if (!meta) throw new HttpError(404, 'Message no longer exists');
    if ((meta.size || 0) > 10 * 1024 * 1024)
      throw new HttpError(413, 'This message exceeds the 10 MB preview limit. Open it in Gmail.');
    const m = await c.fetchOne(
      String(uid),
      { source: true, internalDate: true, threadId: true },
      { uid: true },
    );
    if (!m || !m.source) throw new HttpError(404, 'Message no longer exists');
    const p = await simpleParser(m.source, { skipHtmlToText: true, skipTextToHtml: true });
    return {
      id: messageId,
      threadId: m.threadId || messageId,
      payload: {
        mimeType: 'text/plain',
        headers: p.headerLines.map((h) => ({
          name: h.key,
          value: h.line.slice(h.line.indexOf(':') + 1).trim(),
        })),
        body: { data: Buffer.from(p.text || '').toString('base64url') },
      },
    };
  } finally {
    c.close();
  }
}
