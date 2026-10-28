export function validateEnvironment(env) {
  const required = [
    'APP_URL',
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'CRON_SECRET',
  ];
  const errors = required.filter((key) => !env[key]?.trim()).map((key) => `${key} is required`);
  try {
    const u = new URL(env.APP_URL);
    if (
      u.protocol !== 'https:' ||
      u.pathname !== '/' ||
      u.search ||
      u.hash ||
      u.username ||
      u.password
    )
      errors.push('APP_URL must be a plain HTTPS origin');
  } catch {
    errors.push('APP_URL is invalid');
  }
  try {
    const u = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(u.protocol))
      errors.push('DATABASE_URL must be PostgreSQL');
  } catch {
    errors.push('DATABASE_URL is invalid');
  }
  if (Buffer.from(env.TOKEN_ENCRYPTION_KEY || '', 'base64').length !== 32)
    errors.push('TOKEN_ENCRYPTION_KEY must encode 32 bytes');
  if ((env.CRON_SECRET || '').length < 32)
    errors.push('CRON_SECRET must contain at least 32 characters');
  return errors;
}
