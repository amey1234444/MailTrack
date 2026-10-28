import { query } from './db';
import { HttpError } from './security';
export async function sharedDocument(token: string, includeData = false) {
  const [doc] = await query(
    `SELECT s.id AS share_id,s.delivery_id,d.id,d.name,d.pages${includeData ? ',d.data' : ''} FROM document_shares s JOIN documents d ON d.id=s.document_id WHERE s.token=$1 AND s.revoked=false`,
    [token],
  );
  if (!doc) throw new HttpError(404, 'This document is unavailable or access has been revoked');
  return doc;
}
