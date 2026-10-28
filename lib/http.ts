import { ZodError } from 'zod';
import { HttpError } from './security';
export function api(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return Response.json(
          { error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
          { status: 400 },
        );
      console.error('API failure', e instanceof Error ? e.name : 'UnknownError');
      return Response.json(
        {
          error:
            'The request could not be completed. Check configuration or reconnect your mailbox and try again.',
        },
        { status: 500 },
      );
    }
  };
}
export async function json(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 100000)
    throw new HttpError(413, 'Request is too large');
  const text = await req.text();
  if (text.length > 100000) throw new HttpError(413, 'Request is too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
