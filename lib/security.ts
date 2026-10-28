import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto';
import { query } from './db';
export const id = () => randomBytes(18).toString('base64url');
export const token = () => randomBytes(32).toString('base64url');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (k.length !== 32)
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64');
  return k;
}
export function seal(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(value: string) {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function origin() {
  const u = new URL(process.env.APP_URL || 'http://localhost:3000');
  if (u.protocol !== 'https:' && u.hostname !== 'localhost')
    throw new Error('APP_URL must use HTTPS');
  return u.origin;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  if (req.headers.get('origin') !== origin())
    throw new HttpError(403, 'Request origin is not allowed');
}
export async function rateLimit(key: string, max: number, seconds: number) {
  const [r] = await query(
    `INSERT INTO rate_limits(key,hits,reset_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.hits+1 END, reset_at=CASE WHEN rate_limits.reset_at<now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END RETURNING hits`,
    [key, seconds],
  );
  if (r.hits > max) throw new HttpError(429, 'Too many requests. Please try again later.');
}
export function configured() {
  return [
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'APP_URL',
  ].every((k) => !!process.env[k]);
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
