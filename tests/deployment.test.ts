import { it, expect } from 'vitest';
import { validateEnvironment } from '../scripts/config.mjs';
const valid = {
  APP_URL: 'https://mail.example.com',
  DATABASE_URL: 'postgresql://user:pass@db.example.com/mail',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  CRON_SECRET: 'x'.repeat(32),
};
it('accepts a complete production configuration', () =>
  expect(validateEnvironment(valid)).toEqual([]));
it('fails deployment when required credentials are missing', () =>
  expect(validateEnvironment({})).toContain('DATABASE_URL is required'));
it('rejects insecure origins and weak encryption keys', () => {
  const result = validateEnvironment({
    ...valid,
    APP_URL: 'http://mail.example.com/path',
    TOKEN_ENCRYPTION_KEY: 'bad',
  });
  expect(result).toContain('APP_URL must be a plain HTTPS origin');
  expect(result).toContain('TOKEN_ENCRYPTION_KEY must encode 32 bytes');
});
