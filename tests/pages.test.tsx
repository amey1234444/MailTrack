import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), configured: vi.fn() }));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.user }));
vi.mock('@/lib/security', () => ({ configured: mocks.configured }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import Workspace from '@/app/workspace/page';
beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  mocks.user.mockResolvedValue(null);
});
it('redirects anonymous visitors to real sign-in', async () => {
  await expect(Workspace()).rejects.toThrow('redirect:/login');
});
it('shows configuration failure instead of demo data', async () => {
  mocks.configured.mockReturnValue(false);
  await expect(Workspace()).rejects.toThrow('redirect:/login?status=setup');
});
it('shows database failure instead of demo data', async () => {
  mocks.user.mockRejectedValue(new Error('offline'));
  await expect(Workspace()).rejects.toThrow('redirect:/login?status=unavailable');
});
it('renders only the authenticated user workspace', async () => {
  mocks.user.mockResolvedValue({ name: 'Owner', email: 'owner@example.com', timezone: 'UTC' });
  const page = await Workspace();
  expect(page.props.user.email).toBe('owner@example.com');
  expect(page.props.sample).toBeUndefined();
});
