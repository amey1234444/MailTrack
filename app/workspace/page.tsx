import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { configured } from '@/lib/security';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Workspace() {
  if (!configured()) redirect('/login?status=setup');
  let user;
  try {
    user = await currentUser();
  } catch {
    redirect('/login?status=unavailable');
  }
  if (!user) redirect('/login');
  return (
    <Dashboard
      user={{ name: user.name, email: user.email, timezone: user.timezone }}
      configured
      databaseError={false}
    />
  );
}
