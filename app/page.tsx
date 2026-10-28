import { currentUser } from '@/lib/auth';
import { configured } from '@/lib/security';
import { demoData } from '@/lib/demo';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let user = null;
  let databaseError = false;
  if (configured()) {
    try {
      user = await currentUser();
    } catch {
      databaseError = true;
    }
  }
  return (
    <Dashboard
      user={user ? { name: user.name, email: user.email, timezone: user.timezone } : null}
      configured={configured()}
      databaseError={databaseError}
      sample={demoData}
    />
  );
}
