import { z } from 'zod';
export const email = z
  .email()
  .max(254)
  .transform((x) => x.toLowerCase());
export const composeSchema = z
  .object({
    accountId: z.string().min(1),
    requestKey: z.string().min(16).max(100),
    to: z.array(email).max(20),
    cc: z.array(email).max(20).default([]),
    bcc: z.array(email).max(20).default([]),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((x) => !/[\r\n]/.test(x), 'Subject must be a single line'),
    body: z.string().trim().min(1).max(30000),
    documentIds: z.array(z.string()).max(5).default([]),
  })
  .refine(
    (x) =>
      x.to.length + x.cc.length + x.bcc.length > 0 &&
      x.to.length + x.cc.length + x.bcc.length <= 20,
    'Use between 1 and 20 recipients',
  )
  .refine((x) => urlsIn(x.body).length <= 30, 'Use at most 30 distinct links per email');
export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function safeDestination(s: string) {
  try {
    const u = new URL(s);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export function urlsIn(body: string) {
  return [
    ...new Set(
      (body.match(/https?:\/\/[^\s<>"']+/g) || [])
        .map((s) => s.replace(/[.,;!?)]+$/, ''))
        .filter((s) => !!safeDestination(s)),
    ),
  ];
}
export function bodyHtml(body: string, replacements: Map<string, string>) {
  let out = '',
    position = 0;
  const re = /https?:\/\/[^\s<>"']+/g;
  for (const m of body.matchAll(re)) {
    const start = m.index!,
      raw = m[0],
      url = raw.replace(/[.,;!?)]+$/, '');
    out += escapeHtml(body.slice(position, start));
    const destination = replacements.get(url);
    out += destination
      ? `<a href="${escapeHtml(destination)}">${escapeHtml(url)}</a>${escapeHtml(raw.slice(url.length))}`
      : escapeHtml(raw);
    position = start + raw.length;
  }
  return (out + escapeHtml(body.slice(position))).replace(/\n/g, '<br>');
}
export function bodyText(body: string, replacements: Map<string, string>) {
  return body.replace(/https?:\/\/[^\s<>"']+/g, (raw) => {
    const url = raw.replace(/[.,;!?)]+$/, '');
    return (replacements.get(url) || url) + raw.slice(url.length);
  });
}
function encodedSubject(subject: string) {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of subject) {
    if (Buffer.byteLength(chunk + character, 'utf8') > 42) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks
    .map((value) => `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`)
    .join('\r\n ');
}
export function mime({
  from,
  to,
  subject,
  text,
  html,
  messageId,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
}) {
  if ([from, to, messageId].some((x) => /[\r\n]/.test(x))) throw new Error('Invalid email header');
  const boundary = `mt_${crypto.randomUUID()}`;
  const b64 = (s: string) =>
    Buffer.from(s)
      .toString('base64')
      .match(/.{1,76}/g)
      ?.join('\r\n') || '';
  return Buffer.from(
    [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject(subject)}`,
      `Message-ID: <${messageId}>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(text),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(html),
      `--${boundary}--`,
    ].join('\r\n'),
  ).toString('base64url');
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function looksAutomated(ua: string) {
  return /bot|crawler|scanner|spider|proofpoint|mimecast|barracuda|headless|googleimageproxy|yahoo.*proxy/i.test(
    ua,
  );
}
