import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MailTrack — A little more clarity in your inbox',
  description:
    'Consent-based Gmail analytics. Track email activity, link clicks, document views and replies in one workspace.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
