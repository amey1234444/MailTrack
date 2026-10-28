import { PDFDocument } from 'pdf-lib';
import { api } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { sameOrigin, id, HttpError, rateLimit } from '@/lib/security';
import { query } from '@/lib/db';
export const GET = api(async () => {
  const user = await requireUser();
  return Response.json(
    await query(
      'SELECT id,name,pages,octet_length(data) AS bytes,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC',
      [user.id],
    ),
  );
});
export const POST = api(async (req) => {
  sameOrigin(req);
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 20, 3600);
  if (Number(req.headers.get('content-length') || 0) > 3500000)
    throw new HttpError(413, 'PDF must be smaller than 3 MB');
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 3000000 || file.size < 5)
    throw new HttpError(400, 'Choose a PDF smaller than 3 MB');
  const data = Buffer.from(await file.arrayBuffer());
  if (!data.subarray(0, 5).equals(Buffer.from('%PDF-')))
    throw new HttpError(400, 'This file is not a PDF');
  let pdf;
  try {
    pdf = await PDFDocument.load(data);
  } catch {
    throw new HttpError(400, 'The PDF is damaged or encrypted');
  }
  if (pdf.getPageCount() > 200) throw new HttpError(400, 'PDFs must contain at most 200 pages');
  const documentId = id();
  await query('INSERT INTO documents(id,user_id,name,data,pages) VALUES($1,$2,$3,$4,$5)', [
    documentId,
    user.id,
    file.name.slice(0, 150),
    data,
    pdf.getPageCount(),
  ]);
  return Response.json({ id: documentId });
});
