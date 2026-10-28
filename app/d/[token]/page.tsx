import { sharedDocument } from '@/lib/documents';
import PdfViewer from '@/components/pdf-viewer';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Document({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let doc;
  try {
    doc = await sharedDocument(token);
  } catch {
    notFound();
  }
  return <PdfViewer token={token} name={doc.name} pages={doc.pages} />;
}
