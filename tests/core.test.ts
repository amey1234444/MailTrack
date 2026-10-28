import { beforeEach, describe, it, expect, vi } from 'vitest';
import { seal, unseal, hash, token, sameOrigin, equal } from '@/lib/security';
import {
  composeSchema,
  bodyHtml,
  mime,
  urlsIn,
  safeDestination,
  csvCell,
  looksAutomated,
} from '@/lib/mail';
beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.APP_URL = 'https://mail.example.com';
});
describe('security boundaries', () => {
  it('encrypts tokens with fresh nonces and detects tampering', () => {
    const a = seal('refresh-token'),
      b = seal('refresh-token');
    expect(a).not.toBe(b);
    expect(unseal(a)).toBe('refresh-token');
    const bytes = Buffer.from(a, 'base64url');
    bytes[20] ^= 1;
    expect(() => unseal(bytes.toString('base64url'))).toThrow();
    expect(() => unseal('')).toThrow();
  });
  it('rejects incorrect encryption keys', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'bad';
    expect(() => seal('secret')).toThrow();
  });
  it('requires the configured origin for mutations', () => {
    expect(() =>
      sameOrigin(
        new Request('https://mail.example.com/api/send', {
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toThrow();
    expect(() => sameOrigin(new Request('https://mail.example.com/api/send'))).toThrow();
    expect(() =>
      sameOrigin(
        new Request('https://mail.example.com/api/send', {
          headers: { origin: 'https://mail.example.com' },
        }),
      ),
    ).not.toThrow();
  });
  it('creates unguessable tokens and stable hashes', () => {
    const t = token();
    expect(t).toMatch(/^[\w-]{43}$/);
    expect(hash(t)).toHaveLength(64);
    expect(equal(t, t)).toBe(true);
    expect(equal(t, 'other')).toBe(false);
  });
});
describe('email rendering and validation', () => {
  it('escapes all HTML and only rewrites recognized URLs', () => {
    const body = '<img src=x onerror=alert(1)>\nVisit https://example.com?q=1&x=2.';
    const html = bodyHtml(
      body,
      new Map([['https://example.com?q=1&x=2', 'https://mail.example.com/l/safe']]),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain(
      '<a href="https://mail.example.com/l/safe">https://example.com?q=1&amp;x=2</a>.',
    );
  });
  it('rejects header injection and excessive group sizes', () => {
    const base = {
      accountId: 'a',
      requestKey: '1234567890123456',
      to: ['one@example.com'],
      subject: 'Hello',
      body: 'Hi',
    };
    expect(composeSchema.safeParse(base).success).toBe(true);
    expect(
      composeSchema.safeParse({ ...base, subject: 'Hi\r\nBcc: victim@example.com' }).success,
    ).toBe(false);
    expect(composeSchema.safeParse({ ...base, to: [] }).success).toBe(false);
    expect(
      composeSchema.safeParse({ ...base, to: Array(21).fill('one@example.com') }).success,
    ).toBe(false);
    expect(composeSchema.safeParse({ ...base, to: ['bad\n@example.com'] }).success).toBe(false);
  });
  it('validates safe click destinations', () => {
    expect(safeDestination('javascript:alert(1)')).toBeNull();
    expect(safeDestination('https://user:password@example.com')).toBeNull();
    expect(safeDestination('data:text/html,x')).toBeNull();
    expect(safeDestination('https://example.com/a')).toBe('https://example.com/a');
    expect(urlsIn('https://example.com. https://example.com.')).toEqual(['https://example.com']);
  });
  it('constructs UTF-8 multipart MIME without leaking other recipients', () => {
    const raw = mime({
      from: 'sender@example.com',
      to: 'one@example.com',
      subject: 'Hello नमस्ते',
      text: 'plain',
      html: '<p>Hello</p>',
      messageId: 'unique@example.com',
    });
    const decoded = Buffer.from(raw, 'base64url').toString();
    expect(decoded).toContain('To: one@example.com\r\n');
    expect(decoded).toContain('multipart/alternative');
    expect(decoded).toContain('Message-ID: <unique@example.com>');
    expect(decoded).not.toContain('Bcc:');
    expect(decoded).toContain(Buffer.from('<p>Hello</p>').toString('base64'));
    expect(() =>
      mime({ from: 'a\r\nbcc: x', to: 'a', subject: 'a', text: 'a', html: 'a', messageId: 'a' }),
    ).toThrow();
  });
  it('neutralizes spreadsheet formulas and embedded delimiters', () => {
    expect(csvCell('=IMPORTXML("evil")')).toBe('"\'=IMPORTXML(""evil"")"');
    expect(csvCell(' \t+1')).toMatch(/^"'/);
    expect(csvCell('a,b\nc')).toBe('"a,b\nc"');
  });
  it('only flags automation heuristically', () => {
    expect(looksAutomated('GoogleImageProxy')).toBe(true);
    expect(looksAutomated('Mozilla Firefox')).toBe(false);
  });
});
it('replaces overlapping plaintext URLs independently', async () => {
  const { bodyText } = await import('@/lib/mail');
  expect(
    bodyText(
      'https://example.com https://example.com/full.',
      new Map([
        ['https://example.com', 'https://track/a'],
        ['https://example.com/full', 'https://track/b'],
      ]),
    ),
  ).toBe('https://track/a https://track/b.');
});
it('folds long Unicode subjects into valid encoded words', () => {
  const message = mime({
    from: 'a@example.com',
    to: 'b@example.com',
    subject: 'नमस्ते'.repeat(40),
    text: 'Hi',
    html: 'Hi',
    messageId: 'a@example.com',
  });
  const raw = Buffer.from(message, 'base64url').toString();
  const subject = raw.split('Subject: ')[1].split('\r\nMessage-ID:')[0];
  const words = subject.split('\r\n ');
  expect(words.length).toBeGreaterThan(1);
  expect(words.every((w) => w.length <= 75)).toBe(true);
  expect(words.map((w) => Buffer.from(w.slice(10, -2), 'base64').toString()).join('')).toBe(
    'नमस्ते'.repeat(40),
  );
});
