import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  smtp: { verify: vi.fn(), sendMail: vi.fn(), close: vi.fn() },
  imap: { connect: vi.fn(), on: vi.fn(), close: vi.fn(), mailboxOpen: vi.fn(), fetchOne: vi.fn() },
  transport: vi.fn(),
  client: vi.fn(),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.transport } }));
vi.mock('imapflow', () => ({ ImapFlow: mocks.client }));
import { smtpSend, verifyMailbox, imapMessage, locator, parseLocator } from '@/lib/mailbox';
import { seal } from '@/lib/security';
import { mime } from '@/lib/mail';
import type { Account } from '@/lib/types';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transport.mockReturnValue(mocks.smtp);
  mocks.client.mockImplementation(function () {
    return mocks.imap;
  });
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString('base64');
});
const account = () =>
  ({ email: 'owner@gmail.com', refresh_token: seal('abcdefghijklmnop') }) as Account;
it('verifies IMAP and SMTP over fixed TLS hosts without sending and closes both connections', async () => {
  await verifyMailbox('owner@gmail.com', 'abcdefghijklmnop');
  expect(mocks.client).toHaveBeenCalledWith(
    expect.objectContaining({ host: 'imap.gmail.com', port: 993, secure: true, logger: false }),
  );
  expect(mocks.transport).toHaveBeenCalledWith(
    expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true }),
  );
  expect(mocks.smtp.sendMail).not.toHaveBeenCalled();
  expect(mocks.imap.close).toHaveBeenCalledOnce();
  expect(mocks.smtp.close).toHaveBeenCalledOnce();
});
it('sanitizes provider authentication errors and cleans up after failure', async () => {
  mocks.smtp.verify.mockRejectedValue(new Error('secret provider error'));
  await expect(verifyMailbox('owner@gmail.com', 'abcdefghijklmnop')).rejects.toMatchObject({
    status: 400,
  });
  expect(mocks.imap.close).toHaveBeenCalledOnce();
});
it('sends original MIME with an explicit envelope and does not invent Gmail IDs', async () => {
  mocks.smtp.sendMail.mockResolvedValue({ accepted: ['recipient@example.com'], rejected: [] });
  const raw = mime({
    from: 'owner@gmail.com',
    to: 'recipient@example.com',
    subject: 'Hello',
    text: 'Hi',
    html: '<p>Hi</p>',
    messageId: 'unique@example.com',
  });
  expect(await smtpSend(account(), raw)).toEqual({ id: null, threadId: null });
  expect(mocks.smtp.sendMail).toHaveBeenCalledWith({
    envelope: { from: 'owner@gmail.com', to: ['recipient@example.com'] },
    raw: Buffer.from(raw, 'base64url'),
  });
  expect(mocks.smtp.close).toHaveBeenCalledOnce();
});
it('rejects SMTP refusal rather than reporting delivery success', async () => {
  mocks.smtp.sendMail.mockResolvedValue({ accepted: [], rejected: ['recipient@example.com'] });
  const raw = mime({
    from: 'owner@gmail.com',
    to: 'recipient@example.com',
    subject: 'Hello',
    text: 'Hi',
    html: 'Hi',
    messageId: 'id@example.com',
  });
  await expect(smtpSend(account(), raw)).rejects.toThrow('Delivery rejected');
});
it('validates IMAP locators and refuses stale UIDVALIDITY before fetching content', async () => {
  expect(parseLocator(locator('[Gmail]/All Mail', '3', 12))).toEqual(['[Gmail]/All Mail', '3', 12]);
  expect(() => parseLocator('bad')).toThrow();
  mocks.imap.mailboxOpen.mockResolvedValue({ uidValidity: 4n });
  await expect(imapMessage(account(), locator('INBOX', '3', 12))).rejects.toMatchObject({
    status: 404,
  });
  expect(mocks.imap.fetchOne).not.toHaveBeenCalled();
  expect(mocks.imap.close).toHaveBeenCalledOnce();
});
